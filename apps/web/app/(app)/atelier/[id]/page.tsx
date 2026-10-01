import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { integrations } from '@/lib/env';
import { PageHeader, Page } from '@/components/shell/Shell';
import { Atelier } from '@/components/atelier/Atelier';
import { repoUrl } from '@/lib/integrations/github';

export default async function AtelierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await requireOwner();
  const [{ data: p }, { data: site }] = await Promise.all([
    sb.from('prospects').select('id, name, slug, city, client_email, brand_dna, directions').eq('id', id).single(),
    sb.from('sites').select('*').eq('prospect_id', id).maybeSingle(),
  ]);
  if (!p) notFound();
  const { data: versions } = site
    ? await sb.from('site_versions').select('id, sha, message, url, quality, created_at').eq('site_id', site.id).order('created_at', { ascending: false }).limit(30)
    : { data: [] };
  const { data: changes } = await sb
    .from('share_events')
    .select('message, created_at, share_links!inner(prospect_id)')
    .eq('kind', 'change_request')
    .eq('share_links.prospect_id', id)
    .order('created_at', { ascending: false })
    .limit(10);
  const i = integrations();

  return (
    <>
      <PageHeader title={p.name} sub={site?.preview_url?.replace('https://', '') ?? 'Atelier'} />
      <Page>
        <Atelier
          prospect={{ id: p.id, name: p.name, slug: p.slug, email: p.client_email, hasBrand: !!p.brand_dna }}
          site={site ? { previewUrl: site.preview_url, repo: repoUrl(site.repo), mode: site.mode, domain: site.production_domain, formEmail: site.form_email } : null}
          versions={(versions ?? []) as never}
          changes={(changes ?? []).map((c) => ({ message: c.message as string | null, at: c.created_at as string }))}
          ready={i.github && i.cloudflare}
        />
      </Page>
    </>
  );
}
