import Link from 'next/link';
import { AlertTriangle, FileSignature } from 'lucide-react';
import { STATUS_LABEL, type Status } from '@ph/core';
import { requireOwner } from '@/lib/auth';
import { integrations } from '@/lib/env';
import { loadSettings } from '@/lib/settings';
import { effectiveOffers, type PricingState } from '@/lib/offers';
import { revenueThisYear } from '@/lib/closing';
import { PageHeader, Page } from '@/components/shell/Shell';
import { Group, Row, Empty } from '@/components/ui';
import { euro, relative } from '@/lib/format';
import { ClosingDesk } from './ClosingDesk';
import s from './closing.module.css';

export const metadata = { title: 'Closing' };

export default async function ClosingPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p: selected } = await searchParams;
  const sb = await requireOwner();
  const settings = await loadSettings(sb);
  const [{ data: list }, revenue] = await Promise.all([
    sb.from('ph_prospects').select('id, name, city, status, updated_at').in('status', ['interesse', 'maquette_en_cours', 'maquette_envoyee', 'negociation', 'signe', 'paye', 'en_ligne', 'abonnement_actif']).order('updated_at', { ascending: false }).limit(60),
    revenueThisYear(),
  ]);
  const threshold = Number((settings.raw?.thresholds as { tva?: number } | null)?.tva ?? 37500);

  let desk = null;
  if (selected) {
    const [{ data: p }, { data: quotes }, { data: invoices }, { data: site }, { data: domains }, { data: subs }] = await Promise.all([
      sb.from('ph_prospects').select('id, name, city, address, postal_code, phone, client_email, dirigeants, pricing, status').eq('id', selected).single(),
      sb.from('ph_quotes').select('id, number, offer, total, monthly, status, sign_token, created_at, signature').eq('prospect_id', selected).order('created_at', { ascending: false }),
      sb.from('ph_invoices').select('id, number, total, kind, paid_at, status, created_at').eq('prospect_id', selected).order('created_at', { ascending: false }),
      sb.from('ph_sites').select('id, preview_url, production_domain, mode').eq('prospect_id', selected).maybeSingle(),
      sb.from('ph_domains').select('name, status').eq('prospect_id', selected),
      sb.from('ph_subscriptions').select('monthly, status, unpaid_since').eq('prospect_id', selected),
    ]);
    if (p) {
      const d = ((p.dirigeants ?? []) as { nom?: string; prenoms?: string }[]).find((x) => x.nom);
      desk = (
        <ClosingDesk
          prospect={{ id: p.id, name: p.name, status: p.status as Status, email: p.client_email, phone: p.phone, address: p.address, postalCode: p.postal_code, city: p.city, firstName: d?.prenoms?.split(' ')[0] ?? '', lastName: d?.nom ?? '' }}
          offers={effectiveOffers(p.pricing as PricingState | null)}
          quotes={(quotes ?? []) as never}
          invoices={(invoices ?? []) as never}
          site={site ? { previewUrl: site.preview_url, domain: site.production_domain, mode: site.mode } : null}
          domains={domains ?? []}
          subscriptions={(subs ?? []) as never}
          ready={{ company: settings.companyReady, ...integrations() }}
        />
      );
    }
  }

  return (
    <>
      <PageHeader title="Closing" sub={`CA ${new Date().getFullYear()} : ${euro(revenue)} / ${euro(threshold)} (franchise TVA)`} />
      <Page>
        {!settings.companyReady ? (
          <Link href="/settings#entreprise" className={s.banner}>
            <AlertTriangle size={18} /> Fiche entreprise incomplète : devis et factures bloqués
          </Link>
        ) : null}
        {revenue > threshold * 0.85 ? (
          <div className={s.banner} style={{ color: 'var(--orange)' }}><AlertTriangle size={18} /> Seuil de franchise de TVA bientôt atteint</div>
        ) : null}
        <div className={s.layout}>
          <Group title="Prospects" className={s.list}>
            {(list ?? []).map((x) => (
              <Link key={x.id} href={`/closing?p=${x.id}`} className={`${s.item} ${x.id === selected ? s.itemOn : ''}`}>
                <span className={s.itemName}>{x.name}</span>
                <span className="t-foot c2">{STATUS_LABEL[x.status as Status]} · {relative(x.updated_at)}</span>
              </Link>
            ))}
            {!list?.length ? <Row><span className="c2 t-sub">Aucun prospect avancé</span></Row> : null}
          </Group>
          <div>{desk ?? <Empty icon={<FileSignature />} title="Choisissez un prospect" />}</div>
        </div>
      </Page>
    </>
  );
}
