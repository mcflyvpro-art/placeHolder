import { notFound } from 'next/navigation';
import { Check, X, ExternalLink, MapPin } from 'lucide-react';
import { gridKey, sectorByKey, type SiteAudit, type Status } from '@ph/core';
import { requireOwner } from '@/lib/auth';
import { loadSettings } from '@/lib/settings';
import { PageHeader, Page } from '@/components/shell/Shell';
import { Gauge, Group, Row, Badge } from '@/components/ui';
import { PricingPanel } from '@/components/prospect/PricingPanel';
import { AiPanel, type Analysis, type Direction } from '@/components/prospect/AiPanel';
import { Journal } from '@/components/prospect/Journal';
import { ProspectActions } from '@/components/prospect/ProspectActions';
import { Journey } from '@/components/crm/Journey';
import { loadCrm } from '@/lib/crm';
import { trancheLabel, euro, dateFr } from '@/lib/format';
import type { PricingState } from '@/lib/offers';
import s from '@/components/prospect/prospect.module.css';

function Check2({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={s.check}>
      {ok ? <Check size={15} className={s.ok} /> : <X size={15} className={s.ko} />}
      {label}
    </span>
  );
}

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await requireOwner();
  const [{ data: p }, { data: activities }, { data: jobs }, { data: site }, settings] = await Promise.all([
    sb.from('ph_prospects').select('*').eq('id', id).single(),
    sb.from('ph_activities').select('id, kind, data, created_at').eq('prospect_id', id).order('created_at', { ascending: false }).limit(60),
    sb.from('ph_ai_jobs').select('type, status, created_at, error').eq('prospect_id', id).order('created_at', { ascending: false }),
    sb.from('ph_sites').select('id, preview_url').eq('prospect_id', id).maybeSingle(),
    loadSettings(sb),
  ]);
  if (!p) notFound();
  const crmItem = p.triage === 'kept' || p.triage === 'hot' ? (await loadCrm(sb)).find((x) => x.id === p.id) : undefined;

  const sector = sectorByKey(p.sector ?? '');
  const audit = p.audit as SiteAudit | null;
  const ps = p.pagespeed as { performance: number | null; seo: number | null; accessibility: number | null } | null;
  const reasons = p.score_reasons as { need: string[]; pay: string[] };
  const shot = p.screenshot_path ? (await sb.storage.from('ph-assets').createSignedUrl(p.screenshot_path, 3600)).data?.signedUrl : null;
  const dirigeants = (p.dirigeants ?? []) as { nom?: string; prenoms?: string; qualite?: string; denomination?: string }[];
  const finances = (p.finances ?? {}) as Record<string, { ca?: number; resultat_net?: number }>;
  const lastYear = Object.keys(finances).sort().pop();
  const pricing: PricingState = (p.pricing as PricingState) ?? { pages: sector?.defaultPages ?? 5, options: ['form'] };

  return (
    <>
      <PageHeader
        title={p.name}
        sub={[sector?.label, p.city].filter(Boolean).join(' · ')}
        actions={<ProspectActions id={p.id} name={p.name} phone={p.phone} status={p.status as Status} hasSite={!!site?.preview_url} />}
      />
      <Page>
        {crmItem ? <div style={{ marginBottom: 24 }}><Journey item={crmItem} /></div> : null}
        <div className={s.layout}>
          <div className={s.col}>
            <Group title="Scores">
              <div className={s.scores}>
                <Gauge value={p.need_score} label="Besoin" size={60} />
                <Gauge value={p.pay_score} label="Capacité" size={60} />
                <div className={s.reasonList}>
                  {[...reasons.need, ...reasons.pay].map((r) => <span key={r}>{r}</span>)}
                </div>
              </div>
            </Group>

            <Group title="Registre">
              <Row label="SIREN" value={p.siren ? <span className="t-mono">{p.siren}</span> : <Badge tone="orange">Non trouvé</Badge>} />
              <Row label="Activité" value={p.naf ?? '—'} />
              <Row label="Création" value={dateFr(p.date_creation, { year: 'numeric', month: 'long' })} />
              <Row label="Effectif" value={trancheLabel(p.tranche_effectif) ?? '—'} />
              {lastYear ? <Row label={`CA ${lastYear}`} value={euro(finances[lastYear]?.ca ?? null)} /> : null}
              {dirigeants.slice(0, 3).map((d, i) => (
                <Row key={i} label={d.qualite ?? 'Dirigeant'} value={d.denomination ?? `${d.prenoms ?? ''} ${d.nom ?? ''}`.trim()} />
              ))}
              <Row label="Adresse" value={p.address ?? '—'} />
            </Group>

            <Group title="Google">
              <Row label="Note" value={p.rating ? `${String(p.rating).replace('.', ',')} ★ · ${p.reviews} avis` : '—'} />
              <Row label="Téléphone" value={p.phone ?? '—'} />
              {p.maps_url ? (
                <Row label="Fiche" value={<a href={p.maps_url} target="_blank" rel="noreferrer"><MapPin size={14} /> Maps <ExternalLink size={12} /></a>} />
              ) : null}
              {(p.hours as string[] | null)?.length ? <Row label="Horaires" value={<span className="t-foot">{(p.hours as string[]).join(' · ')}</span>} /> : null}
            </Group>

            <Group title="Site actuel">
              {shot ? (
                <div className={s.shot}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot} alt={`Capture du site de ${p.name}`} />
                </div>
              ) : null}
              <Row label="Adresse" value={p.website ? <a href={p.website} target="_blank" rel="noreferrer">{p.website.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a> : 'Aucun'} />
              {audit ? (
                <Row>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }} className="t-sub">
                    <Check2 ok={audit.https} label="HTTPS" />
                    <Check2 ok={audit.viewport} label="Mobile" />
                    <Check2 ok={audit.legalPage} label="Mentions" />
                    <Check2 ok={!!audit.description} label="SEO" />
                    <Check2 ok={!audit.freeDomain} label="Domaine" />
                    {audit.generator ? <span className="c2">{audit.generator}</span> : null}
                    {audit.copyrightYear ? <span className="c2">© {audit.copyrightYear}</span> : null}
                  </div>
                </Row>
              ) : null}
              {ps ? (
                <Row label="PageSpeed mobile" value={<span className="num">{ps.performance ?? '—'} · SEO {ps.seo ?? '—'} · Accès. {ps.accessibility ?? '—'}</span>} />
              ) : null}
            </Group>
          </div>

          <div className={s.col}>
            <PricingPanel id={p.id} gridKey={gridKey(sector?.group)} grid={settings.grid} payScore={p.pay_score} initial={pricing} />
            <AiPanel
              id={p.id}
              jobs={(jobs ?? []) as never}
              analysis={p.ai_analysis as Analysis | null}
              brandDna={p.brand_dna}
              directions={p.directions as Direction[] | null}
            />
            <Journal id={p.id} activities={(activities ?? []) as never} />
          </div>
        </div>
      </Page>
    </>
  );
}
