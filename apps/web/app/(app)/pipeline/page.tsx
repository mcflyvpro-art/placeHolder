import type { Status } from '@ph/core';
import { requireOwner } from '@/lib/auth';
import { PageHeader } from '@/components/shell/Shell';
import { Board, type BoardCard } from '@/components/pipeline/Board';

export const metadata = { title: 'Pipeline' };

export default async function PipelinePage() {
  const sb = await requireOwner();
  const [{ data: rows }, { data: sites }, { data: links }] = await Promise.all([
    sb.from('prospects').select('id, name, city, status, need_score, pay_score, next_action_at').in('triage', ['kept', 'hot']).neq('status', 'perdu').order('priority', { ascending: false }).limit(500),
    sb.from('sites').select('prospect_id'),
    sb.from('share_links').select('prospect_id, views').eq('active', true),
  ]);
  const withSite = new Set((sites ?? []).map((x) => x.prospect_id));
  const views = new Map((links ?? []).map((l) => [l.prospect_id, l.views as number]));
  const cards: BoardCard[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    status: r.status as Status,
    need: r.need_score,
    pay: r.pay_score,
    nextAt: r.next_action_at,
    hasSite: withSite.has(r.id),
    views: views.get(r.id) ?? 0,
  }));
  return (
    <>
      <PageHeader title="Pipeline" sub={`${cards.length} prospects actifs`} />
      <Board cards={cards} />
    </>
  );
}
