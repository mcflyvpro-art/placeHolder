import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { buildBrief } from '@/lib/sitebrief';
import { fetchHtml, assertPublicUrl } from '@/lib/sources/fetchsite';
import * as gh from '@/lib/integrations/github';
import * as cf from '@/lib/integrations/cloudflare';

const repoName = (slug: string) => `ph-site-${slug}`.slice(0, 90);
const projectName = (slug: string) => `ph-${slug}`.slice(0, 58).replace(/-+$/, '');

async function downloadAsset(url: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  try {
    const u = await assertPublicUrl(url);
    const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 3 * 1024 * 1024) return null;
    const ext = type.includes('svg') ? 'svg' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('x-icon') ? 'ico' : 'jpg';
    return { bytes: buf, ext };
  } catch {
    return null;
  }
}

function oldSiteText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/h\d|\/li|\/div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
    .slice(0, 20_000);
}

/** Crée repo + projet Pages + sous-domaine d'aperçu + Turnstile, et pousse le brief. Idempotent sur le prospect. */
export async function createSite(sb: SupabaseClient, prospectId: string) {
  const { data: p } = await sb.from('ph_prospects').select('*').eq('id', prospectId).single();
  if (!p?.slug) throw new Error('Prospect sans slug');
  const { data: settings } = await sb.from('ph_settings').select('preview_domain').single();
  // Sans domaine de maquettes, l'aperçu reste sur <projet>.pages.dev.
  const previewDomain: string | null = settings?.preview_domain ?? null;

  const repo = repoName(p.slug);
  const project = projectName(p.slug);

  let { data: site } = await sb.from('ph_sites').select('*').eq('prospect_id', prospectId).maybeSingle();

  const pages = await cf.ensurePagesProject(project);
  const pagesHost = pages.subdomain ?? `${project}.pages.dev`;
  let host = pagesHost;
  if (previewDomain) {
    host = `${p.slug}.${previewDomain}`;
    await cf.addPagesDomain(project, host);
    const zone = await cf.zoneId(previewDomain);
    if (zone) await cf.upsertCname(zone, host, pagesHost);
  }

  if (!site) {
    const turnstile = await cf.createTurnstile(`ph ${p.slug}`, [...new Set([host, pagesHost])]).catch(() => null);
    const { data, error } = await sb
      .from('ph_sites')
      .insert({
        prospect_id: prospectId,
        repo,
        pages_project: project,
        preview_url: `https://${host}`,
        turnstile_sitekey: turnstile?.sitekey ?? null,
        turnstile_secret: turnstile?.secret ?? null,
        form_email: p.client_email,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    site = data;
    await gh.generateFromTemplate(repo);
  }

  await gh.setVariable(repo, 'PAGES_PROJECT', project);
  await gh.setVariable(repo, 'SITE_MODE', site.mode === 'production' ? 'production' : 'preview');
  await gh.setVariable(repo, 'PH_WEBHOOK_URL', `${env.appUrl}/api/webhooks/site`);
  await gh.setVariable(repo, 'PH_APP_ORIGIN', new URL(env.appUrl).origin);
  await gh.setSecret(repo, 'CLOUDFLARE_API_TOKEN', env.cloudflareToken!);
  await gh.setSecret(repo, 'CLOUDFLARE_ACCOUNT_ID', env.cloudflareAccount!);
  if (env.siteWebhookSecret) await gh.setSecret(repo, 'SITE_WEBHOOK_SECRET', env.siteWebhookSecret);

  await pushBrief(sb, prospectId, 'brief : données placeHolder');
  await sb.from('ph_prospects').update({ status: p.status === 'interesse' || p.status === 'a_appeler' || p.status === 'rappeler' ? 'maquette_en_cours' : p.status }).eq('id', prospectId);
  await sb.from('ph_activities').insert({ prospect_id: prospectId, kind: 'site', data: { text: `Site créé · ${host}` } });
  return site;
}

/** (Re)pousse brief.json, brand-dna.md, légal et assets dans le repo. */
export async function pushBrief(sb: SupabaseClient, prospectId: string, message: string) {
  const { data: p } = await sb.from('ph_prospects').select('*').eq('id', prospectId).single();
  const { data: site } = await sb.from('ph_sites').select('*').eq('prospect_id', prospectId).single();
  if (!p || !site) throw new Error('Site introuvable');
  const { brief, legal } = buildBrief(p, site);
  const files: gh.RepoFile[] = [
    { path: 'src/content/legal/mentions.md', content: legal.mentions },
    { path: 'src/content/legal/confidentialite.md', content: legal.confidentialite },
    { path: 'src/content/legal/cookies.md', content: legal.cookies },
    { path: 'src/content/legal/cgu.md', content: legal.cgu },
  ];
  if (p.brand_dna) files.push({ path: 'brand-dna.md', content: p.brand_dna });
  if (p.directions) files.push({ path: 'directions/propositions.json', content: JSON.stringify(p.directions, null, 2) });

  if (p.website) {
    const page = await fetchHtml(p.website).catch(() => null);
    if (page) {
      files.push({ path: 'assets/ancien-site.txt', content: oldSiteText(page.html) });
      const audit = p.audit as { ogImage?: string | null; favicon?: string | null } | null;
      for (const [label, url] of [['logo-og', audit?.ogImage], ['favicon', audit?.favicon]] as const) {
        if (!url) continue;
        const asset = await downloadAsset(new URL(url, page.finalUrl).toString());
        if (asset) {
          files.push({ path: `assets/${label}.${asset.ext}`, content: asset.bytes });
          if (label === 'logo-og') brief.brand.logo = `assets/${label}.${asset.ext}`;
        }
      }
    }
  }
  files.push({ path: 'brief.json', content: JSON.stringify(brief, null, 2) + '\n' });
  return gh.commitFiles(site.repo, files, message);
}

/** Passage en production : domaine client branché, noindex levé, analytics activé. */
export async function goLive(sb: SupabaseClient, prospectId: string, domain: string) {
  const { data: site } = await sb.from('ph_sites').select('*').eq('prospect_id', prospectId).single();
  if (!site) throw new Error('Site introuvable');
  await cf.addPagesDomain(site.pages_project, domain);
  await cf.addPagesDomain(site.pages_project, `www.${domain}`).catch(() => {});
  const analytics = site.analytics_token ?? (await cf.createWebAnalytics(domain).catch(() => null));
  if (site.turnstile_sitekey) {
    await cf.updateTurnstileDomains(site.turnstile_sitekey, `ph ${site.pages_project}`, [domain, `www.${domain}`, new URL(site.preview_url).host]).catch(() => {});
  }
  await sb.from('ph_sites').update({ production_domain: domain, mode: 'production', analytics_token: analytics }).eq('id', site.id);
  await gh.setVariable(site.repo, 'SITE_MODE', 'production');
  await pushBrief(sb, prospectId, 'production : domaine client');
}
