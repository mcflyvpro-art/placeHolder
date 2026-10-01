import { REGULATED_NAF } from './naf';

export type ExclusionInput = {
  naf: string | null;
  natureJuridique: string | null;
  etat: string | null;
  businessStatus: string | null;
  chain: boolean;
  procedure: boolean;
};

/** Raison d'exclusion définitive, ou null si le prospect est recevable. */
export function exclusionReason(c: ExclusionInput): string | null {
  if (c.businessStatus && c.businessStatus !== 'OPERATIONAL') return 'Fermé';
  if (c.etat && c.etat !== 'A') return 'Fermé';
  if (c.procedure) return 'Procédure collective';
  if (c.naf && REGULATED_NAF.has(c.naf)) return 'Profession réglementée';
  if (c.natureJuridique?.startsWith('92')) return 'Association';
  if (c.natureJuridique && /^(4|7)/.test(c.natureJuridique)) return 'Secteur public';
  if (c.chain) return 'Chaîne ou franchise';
  return null;
}
