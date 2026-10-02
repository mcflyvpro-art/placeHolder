import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeOffers, gridKey, sectorByKey, type Proposal, type Stage, type Status } from '@ph/core';
import { loadSettings } from '@/lib/settings';
import { effectiveOffers, type PricingState } from '@/lib/offers';
import type { CrmItem } from '@/components/crm/types';

/** Charge tous les prospects suivis (gardés au Tri) avec les données utiles à chaque étape. */
export async function loadCrm(sb: SupabaseClient): Promise<CrmItem[]> {
  const { grid } = await loadSettings(sb);
  const [{ data: rows }, { data: sites }, { data: versions }, { data: links }, { data: quotes }, { data: invoices }, { data: subs }] = await Promise.all([
    sb
      .from('ph_prospects')
      .select('id, name, city, sector, phone, status, lost_stage, lost_reason, need_score, pay_score, next_action_at, stage_at, meeting_at, meeting_mode, meeting_notes, proposal, iterations, call_attempts, pricing')
      .in('triage', ['kept', 'hot'])
      .order('stage_at', { ascending: false })
      .limit(1000),
    sb.from('ph_sites').select('id, prospect_id, preview_url, production_domain, mode'),
    sb.from('ph_site_versions').select('site_id, quality, created_at').order('created_at', { ascending: false }).limit(2000),
    sb.from('ph_share_links').select('prospect_id, views').eq('active', true),
    sb.from('ph_quotes').select('prospect_id, number, status, created_at').order('created_at', { ascending: false }),
    sb.from('ph_invoices').select('prospect_id, kind'),
    sb.from('ph_subscriptions').select('prospect_id, monthly, status'),
  ]);

  const versionsBySite = new Map<string, { n: number; lastPassed: boolean | null }>();
  for (const v of versions ?? []) {
    const cur = versionsBySite.get(v.site_id);
    const passed = (v.quality as { passed?: boolean } | null)?.passed ?? null;
    if (!cur) versionsBySite.set(v.site_id, { n: 1, lastPassed: passed });
    else cur.n++;
  }
  const siteBy = new Map((sites ?? []).map((s) => [s.prospect_id, s]));
  const viewsBy = new Map((links ?? []).map((l) => [l.prospect_id, l.views as number]));
  const quoteBy = new Map<string, { number: string; status: string }>();
  for (const q of quotes ?? []) if (!quoteBy.has(q.prospect_id)) quoteBy.set(q.prospect_id, { number: q.number, status: q.status });
  const deposit = new Set((invoices ?? []).filter((i) => i.kind === 'deposit').map((i) => i.prospect_id));
  const subBy = new Map((subs ?? []).filter((s) => s.status === 'active').map((s) => [s.prospect_id, Number(s.monthly)]));

  // Estimation tant que la tarification n'a pas été ajustée sur la fiche.
  const estimate = (sector: string | null, pay: number) => {
    const sec = sectorByKey(sector ?? '');
    const o = computeOffers({ pages: sec?.defaultPages ?? 5, options: ['form'], sector: gridKey(sec?.group), payScore: pay, grid });
    return { oneOff: o.oneOff.price, setup: o.hybrid.setup, hybridMonthly: o.hybrid.monthly, subMonthly: o.subscription.monthly };
  };

  return (rows ?? []).map((r) => {
    const site = siteBy.get(r.id);
    const v = site ? versionsBySite.get(site.id) : undefined;
    return {
      id: r.id,
      name: r.name,
      city: r.city,
      sector: r.sector,
      phone: r.phone,
      status: r.status as Status,
      lostStage: r.lost_stage as Stage | null,
      lostReason: r.lost_reason,
      need: r.need_score,
      pay: r.pay_score,
      nextAt: r.next_action_at,
      stageAt: r.stage_at,
      meetingAt: r.meeting_at,
      meetingMode: r.meeting_mode,
      meetingNotes: r.meeting_notes,
      proposal: r.proposal as Proposal | null,
      iterations: r.iterations,
      callAttempts: r.call_attempts,
      suggested: effectiveOffers(r.pricing as PricingState | null) ?? estimate(r.sector, r.pay_score),
      site: site ? { previewUrl: site.preview_url, domain: site.production_domain, mode: site.mode, versions: v?.n ?? 0, lastPassed: v?.lastPassed ?? null } : null,
      views: viewsBy.get(r.id) ?? 0,
      quote: quoteBy.get(r.id) ?? null,
      paidDeposit: deposit.has(r.id),
      monthly: subBy.get(r.id) ?? null,
    };
  });
}
