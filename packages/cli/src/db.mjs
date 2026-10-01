import { createClient } from '@supabase/supabase-js';
import { config } from './config.mjs';

export function db() {
  const { url, key } = config();
  if (!url || !key) {
    console.error('Non configuré : lancez `ph login`.');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
