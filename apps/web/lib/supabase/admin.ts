import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/** Client service role : uniquement pour les routes publiques, webhooks et cron. */
export function supabaseAdmin() {
  return createClient(env.supabaseUrl, env.supabaseService, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
