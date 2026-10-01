import 'server-only';
import { env } from '@/lib/env';

const API = 'https://api.porkbun.com/api/json/v3';

async function pb<T = Record<string, unknown>>(path: string, body: object = {}): Promise<T> {
  if (!env.porkbunKey || !env.porkbunSecret) throw new Error('Clés Porkbun absentes');
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: env.porkbunKey, secretapikey: env.porkbunSecret, ...body }),
    cache: 'no-store',
  });
  const json = (await res.json()) as T & { status: string; message?: string; code?: string };
  if (json.status !== 'SUCCESS') throw new Error(`Porkbun ${path}: ${json.message ?? json.code ?? res.status}`);
  return json;
}

export type DomainCheck = { available: boolean; priceCents: number; renewalCents: number | null; premium: boolean };

export async function checkDomain(domain: string): Promise<DomainCheck> {
  const r = await pb<{ response: { avail: string; price: string; regularPrice?: string; premium?: string; additional?: { renewal?: { price: string } } } }>(
    `/domain/checkDomain/${domain}`,
  );
  const toCents = (v?: string) => (v ? Math.round(Number(v) * 100) : null);
  return {
    available: r.response.avail === 'yes',
    priceCents: toCents(r.response.price) ?? 0,
    renewalCents: toCents(r.response.additional?.renewal?.price),
    premium: r.response.premium === 'yes',
  };
}

/** Simulation (dryRun) : coût, solde, réussite — sans rien acheter. */
export async function quoteRegistration(domain: string) {
  return pb<{ wouldSucceed: boolean; cost: number; balance: number; sufficientFunds: boolean; shortfall?: number; message: string }>(
    `/domain/create/${domain}`,
    { cost: 0, agreeToTerms: 'yes', dryRun: true },
  );
}

/** Achat réel. Appelé uniquement après confirmation explicite dans l'interface. */
export async function registerDomain(domain: string, costCents: number) {
  return pb(`/domain/create/${domain}`, { cost: costCents, agreeToTerms: 'yes' });
}

export type Contact = {
  firstName: string;
  lastName: string;
  organization?: string;
  address1: string;
  city: string;
  postalCode: string;
  country: 'FR';
  phone: string;
  phoneCountryCode: '33';
  email: string;
};

/** Le client devient titulaire (registrant) du domaine. */
export async function setRegistrant(domain: string, registrant: Contact) {
  return pb(`/domain/updateContacts/${domain}`, { contacts: { registrant } });
}

export async function setNameservers(domain: string, ns: string[]) {
  return pb(`/domain/updateNs/${domain}`, { ns });
}

export async function getAuthCode(domain: string) {
  return pb<{ authCode?: string }>(`/domain/getAuthCode/${domain}`);
}
