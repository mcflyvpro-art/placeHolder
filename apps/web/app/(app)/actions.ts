'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  advance,
  callOutcomeToStatus,
  sha256Hex,
  slugify,
  type CallOutcome,
  type Status,
} from '@ph/core';
import { requireOwner } from '@/lib/auth';
import { enrichProspect } from '@/lib/enrich';

/** Écrans qui affichent l'état des prospects : vidés du cache client après chaque changement. */
function refreshLists() {
  for (const path of ['/triage', '/pipeline', '/today', '/atelier', '/clients']) revalidatePath(path);
  revalidatePath('/', 'layout');
}

async function log(sb: Awaited<ReturnType<typeof requireOwner>>, prospectId: string, kind: string, data: object = {}) {
  await sb.from('ph_activities').insert({ prospect_id: prospectId, kind, data });
}

async function uniqueSlug(sb: Awaited<ReturnType<typeof requireOwner>>, name: string, city: string | null) {
  const base = slugify(`${name} ${city ?? ''}`) || 'site';
  for (let i = 0; i < 20; i++) {
    const candidate = i ? `${base}-${i + 1}` : base;
    const { data } = await sb.from('ph_prospects').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function triage(id: string, decision: 'kept' | 'dropped' | 'hot') {
  const sb = await requireOwner();
  const { data: p } = await sb.from('ph_prospects').select('id, name, city, place_id, siren, slug').eq('id', id).single();
  if (!p) return;

  if (decision === 'dropped') {
    const { data: settings } = await sb.from('ph_settings').select('retention_days').single();
    const days = settings?.retention_days ?? 30;
    const hashes = [p.place_id && (await sha256Hex(`place:${p.place_id}`)), p.siren && (await sha256Hex(`siren:${p.siren}`))].filter(Boolean) as string[];
    if (hashes.length) await sb.from('ph_blacklist').upsert(hashes.map((hash) => ({ hash })));
    await sb.from('ph_prospects').update({ triage: 'dropped', purge_at: new Date(Date.now() + days * 864e5).toISOString() }).eq('id', id);
    refreshLists();
    return;
  }

  const slug = p.slug ?? (await uniqueSlug(sb, p.name, p.city));
  await sb
    .from('ph_prospects')
    .update({
      triage: decision,
      status: 'a_creer',
      slug,
      purge_at: null,
      next_action_at: decision === 'hot' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  await log(sb, id, 'status', { to: 'a_creer', via: decision });
  refreshLists();
  after(() => enrichProspect(id).catch(() => {}));
}

/** Annule un tri récent : retour dans la pile (la liste noire est nettoyée). */
export async function undoTriage(id: string) {
  const sb = await requireOwner();
  const { data: p } = await sb.from('ph_prospects').select('place_id, siren').eq('id', id).single();
  if (p) {
    const hashes = [p.place_id && (await sha256Hex(`place:${p.place_id}`)), p.siren && (await sha256Hex(`siren:${p.siren}`))].filter(Boolean) as string[];
    if (hashes.length) await sb.from('ph_blacklist').delete().in('hash', hashes);
  }
  await sb.from('ph_prospects').update({ triage: 'pending', purge_at: null, next_action_at: null }).eq('id', id);
  refreshLists();
}

export async function logCall(id: string, outcome: CallOutcome, nextAt?: string | null, note?: string) {
  const sb = await requireOwner();
  const { data: p } = await sb.from('ph_prospects').select('status, call_attempts').eq('id', id).single();
  if (!p) return;
  const attempts = (p.call_attempts ?? 0) + 1;
  const target = callOutcomeToStatus(outcome);
  const status: Status = advance(p.status as Status, target);
  await sb
    .from('ph_prospects')
    .update({
      status,
      call_attempts: attempts,
      next_action_at: outcome === 'callback' ? nextAt ?? null : outcome === 'no_answer' ? new Date(Date.now() + 2 * 864e5).toISOString() : null,
      lost_reason: outcome === 'not_interested' ? 'Pas intéressé au téléphone' : null,
      lost_stage: outcome === 'not_interested' ? p.status : null,
      purge_at: outcome === 'not_interested' ? new Date(Date.now() + 365 * 864e5).toISOString() : null,
    })
    .eq('id', id);
  await log(sb, id, 'call', { outcome, nextAt, note, attempts });
  refreshLists();
}

export async function setStatus(id: string, status: Status, lostReason?: string) {
  const sb = await requireOwner();
  const { data: cur } = await sb.from('ph_prospects').select('status').eq('id', id).single();
  await sb
    .from('ph_prospects')
    .update({
      status,
      lost_stage: status === 'perdu' ? cur?.status ?? null : null,
      lost_reason: status === 'perdu' ? lostReason ?? 'Non précisé' : null,
      purge_at: status === 'perdu' ? new Date(Date.now() + 365 * 864e5).toISOString() : null,
    })
    .eq('id', id);
  await log(sb, id, 'status', { to: status, lostReason });
  refreshLists();
}

export async function setNextAction(id: string, at: string | null) {
  const sb = await requireOwner();
  await sb.from('ph_prospects').update({ next_action_at: at }).eq('id', id);
  revalidatePath('/today');
}

export async function addNote(id: string, text: string) {
  const sb = await requireOwner();
  if (!text.trim()) return;
  await log(sb, id, 'note', { text: text.trim() });
  revalidatePath(`/prospects/${id}`);
}

export async function updateProspect(id: string, patch: Record<string, unknown>) {
  const sb = await requireOwner();
  const allowed = ['client_email', 'name', 'phone', 'pricing', 'final_price', 'brand_dna', 'website'];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  await sb.from('ph_prospects').update(clean).eq('id', id);
  revalidatePath(`/prospects/${id}`);
}

/** Opposition (RGPD) : liste noire + suppression immédiate. Bloqué s'il existe des documents comptables. */
export async function forgetProspect(id: string) {
  const sb = await requireOwner();
  const { count } = await sb.from('ph_invoices').select('id', { count: 'exact', head: true }).eq('prospect_id', id);
  if (count) return { ok: false as const, reason: 'Factures existantes : conservation légale de 10 ans' };
  const { data: p } = await sb.from('ph_prospects').select('place_id, siren').eq('id', id).single();
  const hashes = [p?.place_id && (await sha256Hex(`place:${p.place_id}`)), p?.siren && (await sha256Hex(`siren:${p.siren}`))].filter(Boolean) as string[];
  if (hashes.length) await sb.from('ph_blacklist').upsert(hashes.map((hash) => ({ hash })));
  await sb.from('ph_quotes').delete().eq('prospect_id', id).eq('status', 'draft');
  await sb.from('ph_prospects').delete().eq('id', id);
  revalidatePath('/pipeline');
  return { ok: true as const };
}

export async function queueAiJob(id: string, type: 'analyse' | 'brand_dna' | 'directions') {
  const sb = await requireOwner();
  const { data: open } = await sb.from('ph_ai_jobs').select('id').eq('prospect_id', id).eq('type', type).in('status', ['queued', 'running']).maybeSingle();
  if (!open) await sb.from('ph_ai_jobs').insert({ prospect_id: id, type });
  revalidatePath(`/prospects/${id}`);
}
