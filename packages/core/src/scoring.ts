import type { SiteAudit } from './audit';

export type Scored = { score: number; reasons: string[] };

export type NeedInput = {
  website: string | null;
  audit: SiteAudit | null;
  pagespeed: number | null;
};

export type PayInput = {
  trancheEffectif: string | null;
  ca: number | null;
  dateCreation: string | null;
  reviews: number | null;
  rating: number | null;
  sectorTier: 'high' | 'mid' | 'low';
  entrepreneurIndividuel: boolean;
  now?: Date;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function needScore({ website, audit, pagespeed }: NeedInput): Scored {
  if (!website) return { score: 100, reasons: ['Aucun site'] };
  if (audit?.isSocialOnly) return { score: 100, reasons: ['Réseau social seulement'] };

  const reasons: string[] = [];
  let score = 0;
  const add = (pts: number, reason: string) => {
    score += pts;
    reasons.push(reason);
  };

  if (audit && !audit.reachable) add(60, 'Site injoignable');
  if (audit && !audit.https) add(20, 'Pas de HTTPS');
  if (audit?.reachable && !audit.viewport) add(25, 'Pas adapté mobile');
  if (pagespeed !== null) {
    if (pagespeed < 30) add(25, `Très lent sur mobile (${pagespeed})`);
    else if (pagespeed < 50) add(15, `Lent sur mobile (${pagespeed})`);
  }
  if (audit?.copyrightYear && audit.copyrightYear < 2020) add(15, `© ${audit.copyrightYear}`);
  if (audit && (audit.freeDomain || isBuilder(audit.generator))) {
    add(20, audit.generator ? `Fait avec ${audit.generator}` : 'Domaine gratuit');
  }
  if (audit?.reachable && !audit.legalPage) add(10, 'Pas de mentions légales');
  if (audit?.reachable && (!audit.title || !audit.description)) add(10, 'SEO absent');

  return { score: clamp(score), reasons };
}

const BUILDERS = new Set(['Wix', 'Jimdo', 'Site123', 'Webnode', 'e-monsite', 'Solocal', 'Weebly', 'GoDaddy']);
function isBuilder(g: string | null) {
  return g !== null && BUILDERS.has(g);
}

/** Tranches INSEE : NN/00 = 0 salarié, 01 = 1-2, 02 = 3-5, 03 = 6-9, 11+ = 10 et plus. */
function employees(tranche: string | null): number {
  if (!tranche || tranche === 'NN' || tranche === '00') return 0;
  const map: Record<string, number> = { '01': 1, '02': 3, '03': 6 };
  return map[tranche] ?? 10;
}

function yearsSince(date: string | null, now: Date): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export function payScore(p: PayInput): Scored {
  const now = p.now ?? new Date();
  const reasons: string[] = [];
  let score = 30;
  const add = (pts: number, reason: string) => {
    score += pts;
    reasons.push(reason);
  };

  const emp = employees(p.trancheEffectif);
  if (emp >= 3) add(30, `${emp}+ salariés`);
  else if (emp >= 1) add(20, 'Au moins 1 salarié');

  if (p.ca !== null) {
    if (p.ca > 300_000) add(30, `CA ${Math.round(p.ca / 1000)} k€`);
    else if (p.ca > 100_000) add(20, `CA ${Math.round(p.ca / 1000)} k€`);
  }

  const age = yearsSince(p.dateCreation, now);
  if (age !== null) {
    if (age >= 5) add(15, `${Math.floor(age)} ans d'activité`);
    else if (age >= 2) add(10, `${Math.floor(age)} ans d'activité`);
  }

  if (p.reviews !== null) {
    if (p.reviews >= 80) add(15, `${p.reviews} avis Google`);
    else if (p.reviews >= 20) add(10, `${p.reviews} avis Google`);
  }

  if (p.sectorTier === 'high') add(10, 'Secteur à panier élevé');

  if (p.entrepreneurIndividuel && emp === 0 && age !== null && age < 1) {
    add(-25, 'Indépendant récent sans salarié');
  }
  if (p.rating !== null && p.reviews !== null && p.reviews >= 10 && p.rating < 3.5) {
    add(-10, `Note Google ${p.rating.toString().replace('.', ',')}`);
  }

  return { score: clamp(score), reasons };
}

export function priority(need: number, pay: number): number {
  return Math.round((need * pay) / 100);
}
