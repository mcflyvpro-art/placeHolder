// Identifiants stockés dans le trousseau macOS (jamais dans un fichier).
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SERVICE = 'placeholder-cli';

export function keychainGet(account) {
  try {
    return execFileSync('security', ['find-generic-password', '-s', SERVICE, '-a', account, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function keychainSet(account, value) {
  execFileSync('security', ['add-generic-password', '-U', '-s', SERVICE, '-a', account, '-w', value], { stdio: 'ignore' });
}

export function config() {
  const url = process.env.PH_SUPABASE_URL ?? keychainGet('supabase_url');
  const key = process.env.PH_SUPABASE_SERVICE_KEY ?? keychainGet('supabase_service_key');
  const owner = process.env.PH_GITHUB_OWNER ?? keychainGet('github_owner') ?? 'mcflyvpro-art';
  const sitesDir = process.env.PH_SITES_DIR ?? keychainGet('sites_dir') ?? join(homedir(), 'placeHolder-sites');
  return { url, key, owner, sitesDir };
}
