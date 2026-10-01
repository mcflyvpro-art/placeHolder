import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { emptyAudit, parseSiteHtml, type SiteAudit } from '@ph/core';

const MAX_BYTES = 2 * 1024 * 1024;

function isPrivate(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v === '::';
  }
  const [a, b] = ip.split('.').map(Number) as [number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Garde anti-SSRF : http(s) uniquement, aucune adresse privée ou locale. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocole refusé');
  const host = url.hostname;
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivate)) throw new Error('Adresse refusée');
  return url;
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function fetchHtml(raw: string): Promise<{ html: string; finalUrl: string } | null> {
  let current = raw;
  for (let hop = 0; hop < 5; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; placeHolderAudit/1.0)', Accept: 'text/html' },
      cache: 'no-store',
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, url).toString();
      continue;
    }
    if (!res.ok) return null;
    return { html: await readCapped(res), finalUrl: url.toString() };
  }
  return null;
}

export async function auditSite(website: string): Promise<SiteAudit> {
  const base = emptyAudit(website);
  if (base.isSocialOnly) return base;
  try {
    const page = await fetchHtml(website);
    if (!page) return base;
    return parseSiteHtml(page.html, page.finalUrl);
  } catch {
    return base;
  }
}
