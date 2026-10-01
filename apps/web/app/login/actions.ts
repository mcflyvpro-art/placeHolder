'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/password';
import { SESSION_COOKIE, signSession } from '@/lib/session';

export async function login(_: unknown, form: FormData): Promise<{ error: string | null }> {
  const password = String(form.get('password') ?? '');
  const sb = supabaseAdmin();
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // Anti force brute : 8 échecs en 15 min bloquent la connexion.
  const since = new Date(Date.now() - 15 * 60e3).toISOString();
  const { count } = await sb.from('ph_login_attempts').select('id', { count: 'exact', head: true }).eq('ok', false).gte('created_at', since);
  if ((count ?? 0) >= 8) return { error: 'Trop de tentatives. Réessayez dans 15 minutes.' };

  const { data } = await sb.from('ph_settings').select('owner_password_hash').single();
  const ok = !!data?.owner_password_hash && verifyPassword(password, data.owner_password_hash);
  await sb.from('ph_login_attempts').insert({ ip, ok });
  if (!ok) {
    await new Promise((r) => setTimeout(r, 700));
    return { error: data?.owner_password_hash ? 'Mot de passe incorrect' : 'Mot de passe non défini : lancez « ph password »' };
  }
  const s = signSession();
  (await cookies()).set(SESSION_COOKIE, s.value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: s.maxAge });
  redirect('/today');
}
