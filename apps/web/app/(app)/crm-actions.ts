'use server';

import { revalidatePath } from 'next/cache';
import { advance, nextStage, type MeetingMode, type Proposal, type Stage, type Status } from '@ph/core';
import { requireOwner } from '@/lib/auth';

type Sb = Awaited<ReturnType<typeof requireOwner>>;

function refresh(id: string) {
  for (const p of ['/pipeline', '/clients', '/today', '/atelier', '/closing', `/prospects/${id}`]) revalidatePath(p);
  revalidatePath('/', 'layout');
}

async function log(sb: Sb, id: string, kind: string, data: object) {
  await sb.from('ph_activities').insert({ prospect_id: id, kind, data });
}

async function current(sb: Sb, id: string) {
  const { data } = await sb.from('ph_prospects').select('status, lost_stage, proposal, iterations').eq('id', id).single();
  if (!data) throw new Error('Prospect introuvable');
  return data as { status: Status; lost_stage: Stage | null; proposal: Proposal | null; iterations: number };
}

/** « Il accepte » : passe à l'étape suivante du parcours. */
export async function stepForward(id: string) {
  const sb = await requireOwner();
  const p = await current(sb, id);
  const to = nextStage(p.status);
  if (!to) return;
  await sb.from('ph_prospects').update({ status: to }).eq('id', id);
  await log(sb, id, 'status', { to });
  refresh(id);
}

/** Déplacement libre (glisser-déposer, correction manuelle). */
export async function moveTo(id: string, to: Stage) {
  const sb = await requireOwner();
  await sb.from('ph_prospects').update({ status: to, lost_stage: null, lost_reason: null, purge_at: null }).eq('id', id);
  await log(sb, id, 'status', { to });
  refresh(id);
}

/** « Il refuse » : retour à la maison, en retenant l'étape où ça a cassé. */
export async function markLost(id: string, reason: string) {
  const sb = await requireOwner();
  const p = await current(sb, id);
  if (p.status === 'perdu') return;
  await sb
    .from('ph_prospects')
    .update({
      status: 'perdu',
      lost_stage: p.status,
      lost_reason: reason.trim() || 'Non précisé',
      next_action_at: null,
      purge_at: new Date(Date.now() + 365 * 864e5).toISOString(),
    })
    .eq('id', id);
  await log(sb, id, 'status', { to: 'perdu', lostReason: reason, at: p.status });
  refresh(id);
}

/** Relancer un perdu : il revient à l'étape où il avait été perdu. */
export async function reopen(id: string) {
  const sb = await requireOwner();
  const p = await current(sb, id);
  const to: Stage = p.lost_stage ?? 'appel';
  await sb.from('ph_prospects').update({ status: to, lost_stage: null, lost_reason: null, purge_at: null, next_action_at: new Date().toISOString() }).eq('id', id);
  await log(sb, id, 'status', { to, via: 'relance' });
  refresh(id);
}

/** Rendez-vous calé (depuis l'étape Appel). */
export async function setMeeting(id: string, at: string, mode: MeetingMode, notes: string) {
  const sb = await requireOwner();
  const p = await current(sb, id);
  await sb
    .from('ph_prospects')
    .update({ status: advance(p.status, 'rdv'), meeting_at: at, meeting_mode: mode, meeting_notes: notes.trim() || null, next_action_at: at })
    .eq('id', id);
  await log(sb, id, 'note', { text: `Rendez-vous ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at))}` });
  refresh(id);
}

export async function saveMeetingNotes(id: string, notes: string) {
  const sb = await requireOwner();
  await sb.from('ph_prospects').update({ meeting_notes: notes.trim() || null }).eq('id', id);
  refresh(id);
}

/** Proposition (prix + date de livraison) ; une nouvelle proposition = un tour de négociation de plus. */
export async function setProposal(id: string, input: Omit<Proposal, 'round'>) {
  const sb = await requireOwner();
  const p = await current(sb, id);
  const round = (p.proposal?.round ?? 0) + 1;
  const proposal: Proposal = { ...input, round };
  await sb
    .from('ph_prospects')
    .update({ status: advance(p.status, 'proposition'), proposal, next_action_at: new Date(Date.now() + 2 * 864e5).toISOString() })
    .eq('id', id);
  await log(sb, id, 'note', { text: `Proposition ${round > 1 ? `(tour ${round}) ` : ''}: ${input.price} €${input.monthly ? ` + ${input.monthly} €/mois` : ''}${input.deliveryDate ? `, livraison ${new Intl.DateTimeFormat('fr-FR').format(new Date(input.deliveryDate))}` : ''}` });
  refresh(id);
}

/** Demande d'itération sur la maquette : retour à l'étape Maquette si on était plus loin avant le deal. */
export async function requestIteration(id: string, note: string) {
  const sb = await requireOwner();
  const p = await current(sb, id);
  const back = ['appel', 'rdv', 'proposition'].includes(p.status) ? 'maquette' : p.status;
  await sb.from('ph_prospects').update({ status: back, iterations: p.iterations + 1, next_action_at: new Date().toISOString() }).eq('id', id);
  await log(sb, id, 'share_change', { message: note.trim() || 'Itération demandée' });
  refresh(id);
}
