import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

/**
 * Garantit que la requête vient du propriétaire (cookie de session signé).
 * Toutes les données passent par le service role côté serveur : aucune clé côté navigateur.
 */
export async function requireOwner() {
  const store = await cookies();
  if (!verifySession(store.get(SESSION_COOKIE)?.value)) redirect('/login');
  return supabaseAdmin();
}

/** Variante pour les route handlers : null au lieu de rediriger. */
export async function ownerOrNull() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value) ? supabaseAdmin() : null;
}
