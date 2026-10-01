import { sectorByKey } from '@ph/core';
import { requireOwner } from '@/lib/auth';
import { PageHeader } from '@/components/shell/Shell';
import { trancheLabel, yearOf } from '@/lib/format';
import type { TriageCard } from '@/components/triage/CardStack';
import { TriageClient } from './TriageClient';

export const metadata = { title: 'Tri' };

export default async function TriagePage() {
  const sb = await requireOwner();
  const { data, count } = await sb
    .from('ph_prospects')
    .select('id, name, sector, city, need_score, pay_score, score_reasons, rating, reviews, phone, website, date_creation, tranche_effectif, unverified, screenshot_path', { count: 'exact' })
    .eq('triage', 'pending')
    .order('priority', { ascending: false })
    .limit(40);

  const rows = data ?? [];
  const paths = rows.map((r) => r.screenshot_path).filter(Boolean) as string[];
  const signed = paths.length ? (await sb.storage.from('ph-assets').createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlFor = (p: string | null) => (p ? signed.find((x) => x.path === p)?.signedUrl ?? null : null);

  const cards: TriageCard[] = rows.map((r) => {
    const reasons = r.score_reasons as { need: string[]; pay: string[] };
    return {
      id: r.id,
      name: r.name,
      sectorLabel: sectorByKey(r.sector ?? '')?.label ?? 'Entreprise',
      city: r.city,
      need: r.need_score,
      pay: r.pay_score,
      reasons: [...reasons.need.slice(0, 3), ...reasons.pay.slice(0, 2)],
      rating: r.rating === null ? null : Number(r.rating),
      reviews: r.reviews,
      phone: r.phone,
      website: r.website,
      since: yearOf(r.date_creation),
      employees: trancheLabel(r.tranche_effectif),
      unverified: r.unverified,
      preview: urlFor(r.screenshot_path),
    };
  });

  return (
    <>
      <PageHeader title="Tri" sub={`${count ?? 0} en attente`} />
      <TriageClient initial={cards} />
    </>
  );
}
