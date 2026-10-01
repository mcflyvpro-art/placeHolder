import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { keychainSet, config } from './config.mjs';
import { ask } from './password.mjs';

export async function login() {
  const cur = config();
  const rl = createInterface({ input: stdin, output: stdout });
  const rawUrl = (await rl.question(`URL Supabase${cur.url ? ` [${cur.url}]` : ''} : `)).trim();
  rl.close();
  // Tolère un copier-coller qui inclut du texte autour de l'adresse.
  const url = rawUrl.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)?.[0] ?? cur.url;
  const key = (await ask('Clé secrète Supabase (masquée, stockée dans le trousseau) : ')).trim() || cur.key;
  const rl2 = createInterface({ input: stdin, output: stdout });
  const owner = (await rl2.question(`Compte GitHub [${cur.owner}] : `)).trim() || cur.owner;
  const dir = (await rl2.question(`Dossier des sites [${cur.sitesDir}] : `)).trim() || cur.sitesDir;
  rl2.close();
  if (!url || !key) throw new Error('URL et clé requises');
  keychainSet('supabase_url', url);
  keychainSet('supabase_service_key', key);
  keychainSet('github_owner', owner);
  keychainSet('sites_dir', dir);
  console.log(`Enregistré dans le trousseau macOS (${url}).`);
}
