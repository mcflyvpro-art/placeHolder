import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { keychainSet, config } from './config.mjs';

export async function login() {
  const rl = createInterface({ input: stdin, output: stdout });
  const cur = config();
  const url = (await rl.question(`URL Supabase${cur.url ? ` [${cur.url}]` : ''} : `)).trim() || cur.url;
  const key = (await rl.question('Clé service_role (stockée dans le trousseau) : ')).trim() || cur.key;
  const owner = (await rl.question(`Compte GitHub [${cur.owner}] : `)).trim() || cur.owner;
  const dir = (await rl.question(`Dossier des sites [${cur.sitesDir}] : `)).trim() || cur.sitesDir;
  rl.close();
  if (!url || !key) throw new Error('URL et clé requises');
  keychainSet('supabase_url', url);
  keychainSet('supabase_service_key', key);
  keychainSet('github_owner', owner);
  keychainSet('sites_dir', dir);
  console.log('Enregistré dans le trousseau macOS.');
}
