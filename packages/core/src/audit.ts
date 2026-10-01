export type SiteAudit = {
  reachable: boolean;
  https: boolean;
  viewport: boolean;
  title: string | null;
  description: string | null;
  copyrightYear: number | null;
  generator: string | null;
  freeDomain: boolean;
  legalPage: boolean;
  socials: string[];
  themeColor: string | null;
  ogImage: string | null;
  favicon: string | null;
  isSocialOnly: boolean;
};

const SOCIAL_HOSTS: Record<string, string> = {
  'facebook.com': 'facebook',
  'instagram.com': 'instagram',
  'linkedin.com': 'linkedin',
  'tiktok.com': 'tiktok',
  'youtube.com': 'youtube',
  'x.com': 'x',
  'twitter.com': 'x',
  'pinterest.com': 'pinterest',
};

const NOT_A_SITE = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'tiktok.com',
  'pagesjaunes.fr', 'business.site', 'linktr.ee', 'g.page', 'maps.google', 'google.com',
];

const FREE_DOMAINS = [
  'wixsite.com', 'jimdofree.com', 'jimdosite.com', 'site123.me', 'e-monsite.com',
  'webnode.fr', 'webnode.page', 'sites.google.com', 'wordpress.com', 'over-blog.com',
  'eklablog.com', 'business.site', 'godaddysites.com', 'weebly.com', 'square.site',
];

const GENERATORS: [RegExp, string][] = [
  [/wix/i, 'Wix'],
  [/jimdo/i, 'Jimdo'],
  [/site123/i, 'Site123'],
  [/webnode/i, 'Webnode'],
  [/e-monsite/i, 'e-monsite'],
  [/solocal|pagesjaunes/i, 'Solocal'],
  [/wordpress/i, 'WordPress'],
  [/joomla/i, 'Joomla'],
  [/drupal/i, 'Drupal'],
  [/weebly/i, 'Weebly'],
  [/squarespace/i, 'Squarespace'],
  [/shopify/i, 'Shopify'],
  [/webflow/i, 'Webflow'],
  [/godaddy/i, 'GoDaddy'],
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function hostMatches(host: string, list: string[]): boolean {
  return list.some((d) => host === d || host.endsWith(`.${d}`) || host.includes(d));
}

function metaContent(html: string, key: string, attr: 'name' | 'property' = 'name'): string | null {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`, 'i');
  const m = html.match(re1) ?? html.match(re2);
  const v = m?.[1]?.trim();
  return v ? v : null;
}

/** Signatures fiables dans le HTML quand la meta generator est absente. */
const FINGERPRINTS: [RegExp, string][] = [
  [/static\.wixstatic\.com|wix-bolt/i, 'Wix'],
  [/jimdo(cdn|static)?\.com/i, 'Jimdo'],
  [/\/wp-content\//i, 'WordPress'],
  [/squarespace(-cdn)?\.com/i, 'Squarespace'],
  [/cdn\.shopify\.com/i, 'Shopify'],
  [/webflow\.(com|io)/i, 'Webflow'],
  [/solocal|pagesjaunes/i, 'Solocal'],
];

function detectGenerator(html: string, url: string): string | null {
  const meta = metaContent(html, 'generator');
  if (meta) return GENERATORS.find(([re]) => re.test(meta))?.[1] ?? meta;
  const host = hostOf(url);
  const byHost = GENERATORS.find(([re]) => re.test(host))?.[1];
  if (byHost) return byHost;
  return FINGERPRINTS.find(([re]) => re.test(html))?.[1] ?? null;
}

export function emptyAudit(url: string): SiteAudit {
  const host = hostOf(url);
  return {
    reachable: false,
    https: url.startsWith('https://'),
    viewport: false,
    title: null,
    description: null,
    copyrightYear: null,
    generator: null,
    freeDomain: hostMatches(host, FREE_DOMAINS),
    legalPage: false,
    socials: [],
    themeColor: null,
    ogImage: null,
    favicon: null,
    isSocialOnly: hostMatches(host, NOT_A_SITE),
  };
}

export function parseSiteHtml(html: string, finalUrl: string): SiteAudit {
  const base = emptyAudit(finalUrl);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null;

  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)]
    .map((m) => Number(m[1]))
    .filter((y) => y > 1995 && y < 2100);

  const generator = detectGenerator(html, finalUrl);

  const socials = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const h = hostOf(m[1] ?? '');
    for (const [domain, name] of Object.entries(SOCIAL_HOSTS)) {
      if (h === domain || h.endsWith(`.${domain}`)) socials.add(name);
    }
  }

  const favicon = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null;

  return {
    ...base,
    reachable: true,
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    title,
    description: metaContent(html, 'description'),
    copyrightYear: years.length ? Math.max(...years) : null,
    generator,
    legalPage: /mentions[\s-]*l[ée]gales|legal|cgu|confidentialit/i.test(html),
    socials: [...socials],
    themeColor: metaContent(html, 'theme-color'),
    ogImage: metaContent(html, 'og:image', 'property'),
    favicon,
  };
}
