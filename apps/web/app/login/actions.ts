'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export async function sendMagicLink(_: unknown, form: FormData): Promise<{ sent: boolean }> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  // Réponse identique quel que soit l'email : ne révèle pas l'adresse du propriétaire.
  if (email !== env.ownerEmail) return { sent: true };
  const sb = await supabaseServer();
  await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${env.appUrl}/auth/callback` } });
  return { sent: true };
}
