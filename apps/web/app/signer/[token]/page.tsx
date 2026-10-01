import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { OFFER_LABEL, VAT_MENTION, type OfferKind } from '@ph/core';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { integrations } from '@/lib/env';
import { euro, dateFr } from '@/lib/format';
import { SignForm } from './SignForm';
import s from './signer.module.css';

export const metadata: Metadata = { title: 'Devis', robots: { index: false, follow: false } };

export default async function SignerPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { token } = await params;
  const { paid } = await searchParams;
  const { data: q } = await supabaseAdmin().from('quotes').select('number, offer, lines, total, monthly, commitment_months, deposit_rate, valid_until, status, client, seller, signature').eq('sign_token', token).maybeSingle();
  if (!q) notFound();
  const lines = q.lines as { label: string; detail?: string; unit: number; recurring?: boolean }[];
  const expired = q.status !== 'signed' && new Date(q.valid_until) < new Date(new Date().toISOString().slice(0, 10));
  const deposit = q.offer === 'subscription' ? Number(q.monthly) : Math.round(Number(q.total) * Number(q.deposit_rate) * 100) / 100;

  return (
    <main className={s.page}>
      <div className={s.card}>
        <p className={s.brand}>place<b>Holder</b></p>
        <h1 className="t-title1">Devis {q.number}</h1>
        <p className="t-sub c2">{q.client.denomination} · {OFFER_LABEL[q.offer as OfferKind]} · valable jusqu’au {dateFr(q.valid_until, { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div className={s.lines}>
          {lines.map((l, i) => (
            <div key={i} className={s.line}>
              <div><p className="t-headline">{l.label}</p>{l.detail ? <p className="t-foot c2">{l.detail}</p> : null}</div>
              <p className="t-headline num">{euro(l.unit, 2)}{l.recurring ? ' /mois' : ''}</p>
            </div>
          ))}
        </div>
        <div className={s.total}>
          {Number(q.total) > 0 ? <p><span>Total création</span><b className="num">{euro(Number(q.total), 2)}</b></p> : null}
          {q.monthly ? <p><span>Abonnement</span><b className="num">{euro(Number(q.monthly), 2)} /mois · {q.commitment_months} mois</b></p> : null}
          <p className="t-foot c2">{VAT_MENTION}</p>
        </div>
        <a className={s.pdf} href={`/api/sign/${token}`} target="_blank" rel="noreferrer">Lire le devis complet et les conditions générales (PDF)</a>

        <SignForm
          token={token}
          status={q.status}
          expired={expired}
          signedBy={(q.signature as { name?: string; signedAt?: string } | null) ?? null}
          canPay={integrations().stripe}
          payLabel={q.offer === 'subscription' ? `Activer l’abonnement · ${euro(deposit, 2)}/mois` : `Payer l’acompte · ${euro(deposit, 2)}`}
          paid={paid === '1'}
        />
        <p className="t-foot c3" style={{ marginTop: 18 }}>{q.seller.nom} · SIRET {q.seller.siret}</p>
      </div>
    </main>
  );
}
