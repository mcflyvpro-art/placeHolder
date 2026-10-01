import 'server-only';
import { randomBytes } from 'node:crypto';
import { advance, OPTIONS, quoteLines, sha256Hex, type Client, type OfferKind, type QuoteLine, type Seller, type Status } from '@ph/core';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadSettings } from '@/lib/settings';
import { effectiveOffers, type PricingState } from '@/lib/offers';
import { renderInvoice, renderQuote } from '@/lib/pdf/documents';
import { sendMail } from '@/lib/integrations/mailer';
import { env } from '@/lib/env';

type Prospect = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function clientOf(p: Prospect): Client {
  const d = ((p.dirigeants ?? []) as { nom?: string; prenoms?: string }[]).find((x) => x.nom);
  return {
    denomination: p.name,
    siren: p.siren,
    adresse: p.address,
    email: p.client_email,
    representant: d ? `${d.prenoms ?? ''} ${d.nom ?? ''}`.trim() : null,
  };
}

export async function sellerOrThrow(): Promise<Seller> {
  const { company, companyReady } = await loadSettings(supabaseAdmin());
  if (!companyReady) throw new Error('Fiche entreprise incomplète (Réglages) : SIRET, nom, adresse et email requis');
  return { nom: company.nom!, siret: company.siret!, adresse: company.adresse!, email: company.email!, telephone: company.telephone, iban: company.iban, bic: company.bic };
}

async function nextNumber(kind: 'D' | 'F' | 'A') {
  const { data, error } = await supabaseAdmin().rpc('next_number', { p_kind: kind });
  if (error) throw new Error(error.message);
  return data as string;
}

async function log(prospectId: string, kind: string, data: object) {
  await supabaseAdmin().from('activities').insert({ prospect_id: prospectId, kind, data });
}

export async function createQuote(prospectId: string, offer: OfferKind) {
  const sb = supabaseAdmin();
  const seller = await sellerOrThrow();
  const { data: p } = await sb.from('prospects').select('*').eq('id', prospectId).single();
  if (!p) throw new Error('Prospect introuvable');
  const pricing = p.pricing as PricingState | null;
  const eff = effectiveOffers(pricing);
  if (!eff) throw new Error('Tarification non définie (fiche prospect)');

  const q = quoteLines({
    offer,
    pages: pricing?.pages ?? 5,
    options: (pricing?.options ?? []).map((o) => ({ label: OPTIONS[o]?.label ?? o })),
    ...eff,
  });
  const number = await nextNumber('D');
  const createdAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const client = clientOf(p);
  const pdf = await renderQuote({ number, createdAt, validUntil, offer, lines: q.lines, total: q.total, monthly: q.monthly, commitment: q.commitment, depositRate: 0.3, seller, client });
  const path = `quotes/${number}.pdf`;
  await sb.storage.from('documents').upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  const token = randomBytes(24).toString('base64url');

  const { data: quote, error } = await sb
    .from('quotes')
    .insert({
      prospect_id: prospectId,
      number,
      offer,
      lines: q.lines,
      total: q.total,
      monthly: q.monthly,
      commitment_months: q.commitment,
      valid_until: validUntil,
      client,
      seller,
      status: 'sent',
      sign_token: token,
      pdf_path: path,
      pdf_sha256: await sha256Hex(new Uint8Array(pdf)),
    })
    .select('id, number')
    .single();
  if (error) throw new Error(error.message);
  await sb.from('prospects').update({ status: advance(p.status as Status, 'negociation') }).eq('id', prospectId);
  await log(prospectId, 'quote', { number, event: 'émis' });
  return { ...quote, signUrl: `${env.appUrl}/signer/${token}` };
}

export async function signQuote(token: string, name: string, ip: string | null, userAgent: string | null) {
  const sb = supabaseAdmin();
  const { data: q } = await sb.from('quotes').select('*').eq('sign_token', token).single();
  if (!q) throw new Error('Devis introuvable');
  if (q.status === 'signed') return q;
  if (new Date(q.valid_until) < new Date(new Date().toISOString().slice(0, 10))) throw new Error('Devis expiré');
  const signature = { name: name.trim().slice(0, 120), signedAt: new Date().toISOString(), ip, userAgent: userAgent?.slice(0, 300) ?? null, pdfSha256: q.pdf_sha256, method: 'Signature électronique simple (case « Bon pour accord » + nom)' };
  await sb.from('quotes').update({ status: 'signed', signature }).eq('id', q.id);
  const { data: p } = await sb.from('prospects').select('status, pricing').eq('id', q.prospect_id).single();
  await sb.from('prospects').update({ status: advance(p!.status as Status, 'signe'), final_price: { offer: q.offer, total: q.total, monthly: q.monthly } }).eq('id', q.prospect_id);
  await log(q.prospect_id, 'quote', { number: q.number, event: `signé par ${signature.name}` });
  return { ...q, status: 'signed', signature };
}

const KIND_LABEL: Record<string, string> = { deposit: 'Acompte', balance: 'Solde', subscription: 'Abonnement mensuel', one_off: 'Paiement' };

/** Facture immuable, numérotée, PDF stocké et envoyé au client. Idempotente sur stripeRef. */
export async function issueInvoice(o: { prospectId: string; quoteId: string | null; kind: keyof typeof KIND_LABEL; lines: QuoteLine[]; total: number; paidAt: string | null; stripeRef: string | null }) {
  const sb = supabaseAdmin();
  if (o.stripeRef) {
    const { data: existing } = await sb.from('invoices').select('id').eq('stripe_ref', o.stripeRef).maybeSingle();
    if (existing) return existing;
  }
  const seller = await sellerOrThrow();
  const { data: p } = await sb.from('prospects').select('*').eq('id', o.prospectId).single();
  const { data: q } = o.quoteId ? await sb.from('quotes').select('number').eq('id', o.quoteId).single() : { data: null };
  const client = clientOf(p);
  const number = await nextNumber('F');
  const createdAt = new Date().toISOString();
  const pdf = await renderInvoice({ number, createdAt, paidAt: o.paidAt, lines: o.lines, total: o.total, seller, client, quoteNumber: q?.number ?? null, kindLabel: KIND_LABEL[o.kind] ?? '' });
  const path = `invoices/${number}.pdf`;
  await sb.storage.from('documents').upload(path, pdf, { contentType: 'application/pdf' });
  const { data: inv, error } = await sb
    .from('invoices')
    .insert({ prospect_id: o.prospectId, quote_id: o.quoteId, number, kind: o.kind, lines: o.lines, total: o.total, client, seller, paid_at: o.paidAt, status: o.paidAt ? 'paid' : 'issued', stripe_ref: o.stripeRef, pdf_path: path })
    .select('id, number')
    .single();
  if (error) throw new Error(error.message);
  await log(o.prospectId, 'payment', { amount: o.total, number, kind: o.kind });
  if (client.email) {
    await sendMail({
      to: client.email,
      subject: `Facture ${number} — ${seller.nom}`,
      text: `Bonjour,\n\nVeuillez trouver ci-joint la facture ${number} (${KIND_LABEL[o.kind]}).\n\nMerci pour votre confiance.\n${seller.nom}`,
      attachments: [{ filename: `${number}.pdf`, content: pdf }],
    }).catch(() => false);
  }
  return inv;
}

/** Chiffre d'affaires encaissé sur l'année civile (suivi du seuil de franchise en base de TVA). */
export async function revenueThisYear() {
  const start = `${new Date().getFullYear()}-01-01`;
  const { data } = await supabaseAdmin().from('invoices').select('total').gte('paid_at', start).neq('status', 'credited');
  return (data ?? []).reduce((a, r) => a + Number(r.total), 0);
}
