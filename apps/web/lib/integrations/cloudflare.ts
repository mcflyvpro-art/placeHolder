import 'server-only';
import { env } from '@/lib/env';

const API = 'https://api.cloudflare.com/client/v4';

async function cf<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = env.cloudflareToken;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN absent');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
  const json = (await res.json()) as { success: boolean; result: T; errors?: { message: string; code: number }[] };
  if (!json.success) throw new Error(`Cloudflare ${path}: ${json.errors?.map((e) => `${e.code} ${e.message}`).join(', ')}`);
  return json.result;
}

const acc = () => {
  const a = env.cloudflareAccount;
  if (!a) throw new Error('CLOUDFLARE_ACCOUNT_ID absent');
  return a;
};

export async function ensurePagesProject(name: string) {
  try {
    return await cf<{ subdomain: string }>(`/accounts/${acc()}/pages/projects/${name}`);
  } catch {
    return await cf<{ subdomain: string }>(`/accounts/${acc()}/pages/projects`, {
      method: 'POST',
      body: JSON.stringify({ name, production_branch: 'main' }),
    });
  }
}

export async function addPagesDomain(project: string, host: string) {
  try {
    await cf(`/accounts/${acc()}/pages/projects/${project}/domains`, { method: 'POST', body: JSON.stringify({ name: host }) });
  } catch (e) {
    if (!String(e).includes('already')) throw e;
  }
}

export async function removePagesDomain(project: string, host: string) {
  await cf(`/accounts/${acc()}/pages/projects/${project}/domains/${host}`, { method: 'DELETE' });
}

export async function zoneId(domain: string): Promise<string | null> {
  const zones = await cf<{ id: string }[]>(`/zones?name=${encodeURIComponent(domain)}`);
  return zones[0]?.id ?? null;
}

/** CNAME `<sub>.<zone>` → `<project>.pages.dev`, proxifié. Idempotent. */
export async function upsertCname(zone: string, name: string, target: string) {
  const existing = await cf<{ id: string }[]>(`/zones/${zone}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`);
  const body = JSON.stringify({ type: 'CNAME', name, content: target, proxied: true, ttl: 1 });
  if (existing[0]) await cf(`/zones/${zone}/dns_records/${existing[0].id}`, { method: 'PUT', body });
  else await cf(`/zones/${zone}/dns_records`, { method: 'POST', body });
}

export async function createTurnstile(name: string, domains: string[]) {
  return cf<{ sitekey: string; secret: string }>(`/accounts/${acc()}/challenges/widgets`, {
    method: 'POST',
    body: JSON.stringify({ name: name.slice(0, 254), domains, mode: 'managed' }),
  });
}

export async function updateTurnstileDomains(sitekey: string, name: string, domains: string[]) {
  await cf(`/accounts/${acc()}/challenges/widgets/${sitekey}`, {
    method: 'PUT',
    body: JSON.stringify({ name: name.slice(0, 254), domains, mode: 'managed' }),
  });
}

export async function createWebAnalytics(host: string) {
  const r = await cf<{ site_token: string; site_tag: string }>(`/accounts/${acc()}/rum/site_info`, {
    method: 'POST',
    body: JSON.stringify({ host, auto_install: false }),
  });
  return r.site_token;
}

export async function verifyTurnstile(secret: string, token: string, ip?: string | null) {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const j = (await res.json()) as { success: boolean };
  return j.success;
}

/** Zone Cloudflare pour un domaine client (DNS + routage email + domaine Pages apex). */
export async function ensureZone(domain: string) {
  const existing = await cf<{ id: string; name_servers: string[] }[]>(`/zones?name=${encodeURIComponent(domain)}`);
  if (existing[0]) return existing[0];
  return cf<{ id: string; name_servers: string[] }>(`/zones`, {
    method: 'POST',
    body: JSON.stringify({ name: domain, account: { id: acc() }, type: 'full' }),
  });
}

/** Routage email gratuit : contact@domaine → boîte du client (le client confirme l'adresse par email). */
export async function setupEmailRouting(zone: string, domain: string, destination: string) {
  await cf(`/zones/${zone}/email/routing/enable`, { method: 'POST' }).catch(() => {});
  await cf(`/accounts/${acc()}/email/routing/addresses`, { method: 'POST', body: JSON.stringify({ email: destination }) }).catch(() => {});
  await cf(`/zones/${zone}/email/routing/rules`, {
    method: 'POST',
    body: JSON.stringify({
      name: `contact ${domain}`,
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: `contact@${domain}` }],
      actions: [{ type: 'forward', value: [destination] }],
    }),
  });
}
