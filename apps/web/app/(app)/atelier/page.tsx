import Link from 'next/link';
import { PenTool } from 'lucide-react';
import { requireOwner } from '@/lib/auth';
import { PageHeader, Page } from '@/components/shell/Shell';
import { Group, Row, Empty, Badge } from '@/components/ui';
import { relative } from '@/lib/format';

export const metadata = { title: 'Atelier' };

export default async function AtelierList() {
  const sb = await requireOwner();
  const { data: sites } = await sb
    .from('sites')
    .select('id, prospect_id, preview_url, production_domain, mode, prospects(name, city, status), site_versions(sha, created_at, quality)')
    .order('created_at', { ascending: false });
  const { data: candidates } = await sb.from('prospects').select('id, name, city').in('status', ['interesse', 'maquette_en_cours']).limit(20);
  const withSite = new Set((sites ?? []).map((s) => s.prospect_id));
  const waiting = (candidates ?? []).filter((c) => !withSite.has(c.id));

  type SiteRow = { id: string; prospect_id: string; preview_url: string | null; production_domain: string | null; mode: string; prospects: { name: string; city: string | null }; site_versions: { sha: string; created_at: string; quality: { passed?: boolean } | null }[] };

  return (
    <>
      <PageHeader title="Atelier" sub={`${sites?.length ?? 0} sites`} />
      <Page>
        <div style={{ display: 'grid', gap: 24 }}>
          {waiting.length ? (
            <Group title="Intéressés sans maquette">
              {waiting.map((p) => (
                <Row key={p.id}>
                  <Link href={`/atelier/${p.id}`} style={{ flex: 1, color: 'inherit' }}><b>{p.name}</b> <span className="c2">· {p.city}</span></Link>
                  <Badge tone="orange">À créer</Badge>
                </Row>
              ))}
            </Group>
          ) : null}
          {sites?.length ? (
            <Group title="Sites">
              {(sites as unknown as SiteRow[]).map((s) => {
                const last = [...(s.site_versions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                return (
                  <Row key={s.id}>
                    <Link href={`/atelier/${s.prospect_id}`} style={{ flex: 1, color: 'inherit', minWidth: 0 }}>
                      <b>{s.prospects.name}</b>
                      <span className="c2 t-foot" style={{ display: 'block' }}>{s.production_domain ?? s.preview_url?.replace('https://', '')}</span>
                    </Link>
                    {last ? <span className="t-foot c2">{relative(last.created_at)}</span> : null}
                    {s.mode === 'production' ? <Badge tone="green">En ligne</Badge> : last?.quality?.passed === false ? <Badge tone="orange">Qualité</Badge> : <Badge>Aperçu</Badge>}
                  </Row>
                );
              })}
            </Group>
          ) : !waiting.length ? (
            <Empty icon={<PenTool />} title="Aucun site" />
          ) : null}
        </div>
      </Page>
    </>
  );
}
