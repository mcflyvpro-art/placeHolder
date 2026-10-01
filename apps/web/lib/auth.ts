import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { env } from '@/lib/env';

/** Garantit que la requête vient du propriétaire. Retourne le client Supabase authentifié. */
export async function requireOwner() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user || data.user.email?.toLowerCase() !== env.ownerEmail) redirect('/login');
  return sb;
}

/** Variante pour les route handlers : renvoie null au lieu de rediriger. */
export async function ownerOrNull() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user || data.user.email?.toLowerCase() !== env.ownerEmail) return null;
  return sb;
}
