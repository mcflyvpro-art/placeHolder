import { requireOwner } from '@/lib/auth';
import { integrations } from '@/lib/env';
import { PageHeader, Page } from '@/components/shell/Shell';
import { RadarPanel } from './RadarPanel';

export const metadata = { title: 'Radar' };

export default async function RadarPage() {
  const sb = await requireOwner();
  const [{ data: settings }, { data: searches }] = await Promise.all([
    sb.from('ph_settings').select('google_calls_month, google_cap, google_month').single(),
    sb.from('ph_searches').select('id, sectors, zone, status, found, kept, excluded, budget, calls, error, created_at').order('created_at', { ascending: false }).limit(12),
  ]);
  const month = new Date().toISOString().slice(0, 7);
  const used = settings?.google_month === month ? settings.google_calls_month : 0;
  return (
    <>
      <PageHeader title="Radar" sub={`Google : ${used} / ${settings?.google_cap ?? 950} ce mois`} />
      <Page>
        <RadarPanel
          googleReady={integrations().google}
          quota={{ used, cap: settings?.google_cap ?? 950 }}
          searches={(searches ?? []).map((s) => ({
            id: s.id,
            sectors: s.sectors,
            zone: s.zone,
            status: s.status,
            found: s.found,
            kept: s.kept,
            excluded: s.excluded,
            error: s.error,
            total: s.budget,
            done: Math.min(s.calls, s.budget),
            createdAt: s.created_at,
          }))}
        />
      </Page>
    </>
  );
}
