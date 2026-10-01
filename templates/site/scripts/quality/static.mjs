import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BANNED_PHRASES, SLOP_EMOJI, SLOP_COLORS, MAX_EM_DASH_PER_PAGE } from './slop.mjs';

const DIST = 'dist';

function walk(dir, ext) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&rsquo;|&#8217;/g, '’')
    .replace(/\s+/g, ' ');

export function staticChecks({ production }) {
  const pages = walk(DIST, '.html');
  const css = walk(DIST, '.css');
  const issues = { todo: [], slop: [], legal: [], links: [] };

  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const text = visibleText(html);
    const lower = text.toLowerCase();
    const name = relative(DIST, page);

    const todos = text.match(/\[À COMPLÉTER[^\]]*\]/g) ?? [];
    for (const t of todos) issues.todo.push(`${name}: ${t}`);

    for (const phrase of BANNED_PHRASES) if (lower.includes(phrase)) issues.slop.push(`${name}: « ${phrase} »`);
    if (SLOP_EMOJI.test(text)) issues.slop.push(`${name}: emoji décoratif`);
    const dashes = (text.match(/—/g) ?? []).length;
    if (dashes > MAX_EM_DASH_PER_PAGE) issues.slop.push(`${name}: ${dashes} tirets cadratins`);

    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      const href = m[1];
      if (href === '/') continue;
      const candidates = [join(DIST, href), join(DIST, `${href}.html`), join(DIST, href, 'index.html')];
      if (!candidates.some((c) => existsSync(c))) issues.links.push(`${name} → ${href}`);
    }
  }

  for (const file of css) {
    if (SLOP_COLORS.test(readFileSync(file, 'utf8'))) issues.slop.push(`${relative(DIST, file)}: palette violette générique`);
  }

  for (const p of ['mentions-legales', 'confidentialite', 'cookies', 'cgu']) {
    if (!existsSync(join(DIST, `${p}.html`))) issues.legal.push(`page manquante : ${p}`);
  }
  const mentions = existsSync(join(DIST, 'mentions-legales.html')) ? visibleText(readFileSync(join(DIST, 'mentions-legales.html'), 'utf8')) : '';
  if (!/SIREN/.test(mentions)) issues.legal.push('SIREN absent des mentions légales');
  if (!/Cloudflare/.test(mentions)) issues.legal.push('hébergeur absent des mentions légales');

  const blocking = [...issues.slop, ...issues.legal, ...issues.links, ...(production ? issues.todo : [])];
  return { pages: pages.length, issues, passed: blocking.length === 0 };
}
