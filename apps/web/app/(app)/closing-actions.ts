'use server';

import { revalidatePath } from 'next/cache';
import { advance, type OfferKind, type Status } from '@ph/core';
import { requireOwner } from '@/lib/auth';
import { env } from '@/lib/env';
import { createQuote } from '@/lib/closing';
import { createCheckout } from '@/lib/integrations/stripe';
import * as porkbun from '@/lib/integrations/porkbun';
import * as cf from '@/lib/integrations/cloudflare';
import { goLive } from '@/lib/sites';
import { transferRepo } from '@/lib/integrations/github';
import { qrSvgDataUri } from '@/lib/qr';

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : 'Erreur' });

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export async function createQuoteAction(prospectId: string, offer: OfferKind): Promise<R<{ signUrl: string; qr: string; number: string }>> {
  await requireOwner();
  try {
    const q = await createQuote(prospectId, offer);
    revalidatePath('/closing');
    return { ok: true, signUrl: q.signUrl, number: q.number, qr: await qrSvgDataUri(q.signUrl) };
  } catch (e) {
    return fail(e);
  }
}

/** Lien de paiement du solde (création seule / hybride), à envoyer à la livraison. */
export async function balanceLinkAction(quoteId: string): Promise<R<{ url: string }>> {
  const sb = await requireOwner();
  try {
    const { data: q } = await sb.from('ph_quotes').select('*').eq('id', quoteId).single();
    if (!q || q.status !== 'signed') throw new Error('Devis non signé');
    const amount = Math.round((Number(q.total) - Number(q.total) * Number(q.deposit_rate)) * 100) / 100;
    const s = await createCheckout({ kind: 'balance', quoteId: q.id, prospectId: q.prospect_id, label: `Solde — devis ${q.number}`, amount, email: q.client.email, successUrl: `${env.appUrl}/signer/${q.sign_token}?paid=1`, cancelUrl: `${env.appUrl}/signer/${q.sign_token}` });
    return { ok: true, url: s.url! };
  } catch (e) {
    return fail(e);
  }
}

/** Lien d'activation de l'abonnement (offre hybride, à la mise en ligne). */
export async function subscriptionLinkAction(quoteId: string): Promise<R<{ url: string }>> {
  const sb = await requireOwner();
  try {
    const { data: q } = await sb.from('ph_quotes').select('*').eq('id', quoteId).single();
    if (!q?.monthly) throw new Error('Pas d’abonnement sur ce devis');
    const s = await createCheckout({ kind: 'subscription', quoteId: q.id, prospectId: q.prospect_id, label: `Site ${q.client.denomination} — abonnement`, amount: Number(q.monthly), email: q.client.email, successUrl: `${env.appUrl}/signer/${q.sign_token}?paid=1`, cancelUrl: `${env.appUrl}/signer/${q.sign_token}`, commitmentMonths: q.commitment_months });
    return { ok: true, url: s.url! };
  } catch (e) {
    return fail(e);
  }
}

export async function checkDomainAction(domain: string): Promise<R<{ available: boolean; price: number; renewal: number | null; balance: number | null; sufficient: boolean | null }>> {
  await requireOwner();
  const d = domain.trim().toLowerCase();
  if (!DOMAIN_RE.test(d)) return { ok: false, error: 'Nom de domaine invalide' };
  try {
    const c = await porkbun.checkDomain(d);
    if (!c.available) return { ok: true, available: false, price: 0, renewal: null, balance: null, sufficient: null };
    const dry = await porkbun.quoteRegistration(d).catch(() => null);
    return { ok: true, available: true, price: c.priceCents / 100, renewal: c.renewalCents ? c.renewalCents / 100 : null, balance: dry ? dry.balance / 100 : null, sufficient: dry?.sufficientFunds ?? null };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Achat réel du domaine. Exige la saisie exacte du nom (confirmation explicite côté UI),
 * puis le client devient titulaire et le DNS passe sur Cloudflare.
 */
export async function registerDomainAction(prospectId: string, domain: string, confirm: string, registrant: porkbun.Contact): Promise<R> {
  const sb = await requireOwner();
  const d = domain.trim().toLowerCase();
  if (confirm.trim().toLowerCase() !== d) return { ok: false, error: 'Confirmation incorrecte' };
  try {
    const c = await porkbun.checkDomain(d);
    if (!c.available) throw new Error('Domaine plus disponible');
    if (c.premium) throw new Error('Domaine premium : achat manuel');
    await porkbun.registerDomain(d, c.priceCents);
    await porkbun.setRegistrant(d, registrant).catch(() => {});
    const zone = await cf.ensureZone(d);
    await porkbun.setNameservers(d, zone.name_servers);
    await sb.from('ph_domains').insert({ prospect_id: prospectId, name: d, registrant, status: 'registered', expires_at: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10) });
    await sb.from('ph_activities').insert({ prospect_id: prospectId, kind: 'site', data: { text: `Domaine ${d} enregistré au nom du client` } });
    revalidatePath('/closing');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Branche un domaine (acheté ici ou déjà détenu par le client) et passe le site en production. */
export async function connectDomainAction(prospectId: string, domain: string, forwardTo: string | null): Promise<R<{ nameservers: string[] }>> {
  const sb = await requireOwner();
  const d = domain.trim().toLowerCase();
  if (!DOMAIN_RE.test(d)) return { ok: false, error: 'Nom de domaine invalide' };
  try {
    const zone = await cf.ensureZone(d);
    const { data: site } = await sb.from('ph_sites').select('pages_project').eq('prospect_id', prospectId).single();
    if (!site) throw new Error('Créez le site d’abord (Atelier)');
    await cf.upsertCname(zone.id, d, `${site.pages_project}.pages.dev`);
    await cf.upsertCname(zone.id, `www.${d}`, `${site.pages_project}.pages.dev`);
    if (forwardTo) await cf.setupEmailRouting(zone.id, d, forwardTo);
    await goLive(sb, prospectId, d);
    const { data: p } = await sb.from('ph_prospects').select('status').eq('id', prospectId).single();
    if (p) await sb.from('ph_prospects').update({ status: advance(p.status as Status, 'en_ligne') }).eq('id', prospectId);
    await sb.from('ph_domains').upsert({ prospect_id: prospectId, name: d, status: 'live', forwards: forwardTo ? { contact: forwardTo } : null }, { onConflict: 'name' });
    revalidatePath('/closing');
    return { ok: true, nameservers: zone.name_servers };
  } catch (e) {
    return fail(e);
  }
}

/** Offre « création seule » : transfert du repo au compte GitHub du client. */
export async function transferRepoAction(prospectId: string, githubUser: string): Promise<R> {
  const sb = await requireOwner();
  try {
    const { data: site } = await sb.from('ph_sites').select('repo').eq('prospect_id', prospectId).single();
    if (!site) throw new Error('Site introuvable');
    await transferRepo(site.repo, githubUser.trim());
    await sb.from('ph_activities').insert({ prospect_id: prospectId, kind: 'site', data: { text: `Code transféré à ${githubUser}` } });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function documentUrl(kind: 'quotes' | 'invoices', id: string): Promise<string | null> {
  const sb = await requireOwner();
  const { data } = await sb.from(kind).select('pdf_path').eq('id', id).single();
  if (!data?.pdf_path) return null;
  const { data: url } = await sb.storage.from('ph-documents').createSignedUrl(data.pdf_path, 120);
  return url?.signedUrl ?? null;
}
