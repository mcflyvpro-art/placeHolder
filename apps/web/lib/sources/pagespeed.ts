import 'server-only';
import { env } from '@/lib/env';

export type PageSpeed = { performance: number | null; seo: number | null; accessibility: number | null; screenshot: string | null };

export async function pagespeed(url: string): Promise<PageSpeed | null> {
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', url);
  api.searchParams.set('strategy', 'mobile');
  for (const c of ['performance', 'seo', 'accessibility']) api.searchParams.append('category', c);
  if (env.pagespeedKey) api.searchParams.set('key', env.pagespeedKey);
  try {
    const res = await fetch(api, { cache: 'no-store', signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score: number | null }>;
        audits?: Record<string, { details?: { data?: string } }>;
      };
    };
    const cat = j.lighthouseResult?.categories ?? {};
    const pct = (k: string) => (cat[k]?.score == null ? null : Math.round(cat[k]!.score! * 100));
    return {
      performance: pct('performance'),
      seo: pct('seo'),
      accessibility: pct('accessibility'),
      screenshot: j.lighthouseResult?.audits?.['final-screenshot']?.details?.data ?? null,
    };
  } catch {
    return null;
  }
}
