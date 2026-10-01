'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import type { Grid } from '@ph/core';

const SIRET = /^\d{14}$/;

export async function saveCompany(_: unknown, form: FormData): Promise<{ ok: boolean; error?: string }> {
  const sb = await requireOwner();
  const get = (k: string) => String(form.get(k) ?? '').trim();
  const siret = get('siret').replace(/\s/g, '');
  if (siret && !SIRET.test(siret)) return { ok: false, error: 'SIRET : 14 chiffres' };
  const company = {
    nom: get('nom'), siret, adresse: get('adresse'), email: get('email'), telephone: get('telephone'),
    iban: get('iban').replace(/\s/g, ''), bic: get('bic'), activite: get('activite'),
  };
  await sb.from('settings').update({ company }).eq('id', true);
  revalidatePath('/settings');
  revalidatePath('/closing');
  return { ok: true };
}

export async function saveGeneral(_: unknown, form: FormData): Promise<{ ok: boolean; error?: string }> {
  const sb = await requireOwner();
  const num = (k: string, d: number) => {
    const n = Number(String(form.get(k) ?? '').replace(/\s/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  const preview = String(form.get('preview_domain') ?? '').trim().toLowerCase().replace(/^https?:\/\//, '') || null;
  const { data } = await sb.from('settings').select('thresholds').single();
  await sb
    .from('settings')
    .update({
      preview_domain: preview,
      google_cap: Math.min(1000, num('google_cap', 950)),
      retention_days: Math.max(1, num('retention_days', 30)),
      thresholds: { ...(data?.thresholds ?? {}), tva: num('tva', 37500) },
    })
    .eq('id', true);
  revalidatePath('/settings');
  return { ok: true };
}

export async function saveGrid(grid: Grid) {
  const sb = await requireOwner();
  await sb.from('settings').update({ grid }).eq('id', true);
  revalidatePath('/settings');
}

export async function signOut() {
  const sb = await requireOwner();
  await sb.auth.signOut();
  redirect('/login');
}
