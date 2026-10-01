import 'server-only';
import { DEFAULT_GRID, type Grid } from '@ph/core';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Company = {
  nom?: string;
  siret?: string;
  adresse?: string;
  email?: string;
  telephone?: string;
  iban?: string;
  bic?: string;
  assurance?: string;
  activite?: string;
};

export async function loadSettings(sb: SupabaseClient) {
  const { data } = await sb.from('settings').select('*').single();
  const grid: Grid = { ...DEFAULT_GRID, ...((data?.grid as Grid) ?? {}) };
  const company = (data?.company ?? {}) as Company;
  return { raw: data, grid, company, companyReady: !!(company.nom && company.siret && company.adresse && company.email) };
}
