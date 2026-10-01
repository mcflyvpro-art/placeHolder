import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { db } from './db.mjs';
import { config } from './config.mjs';

export async function site(slug) {
  if (!slug) {
    console.error('Usage : ph site <slug>');
    process.exit(1);
  }
  const sb = db();
  const { owner, sitesDir } = config();
  const { data: p } = await sb.from('ph_prospects').select('id, name').eq('slug', slug).maybeSingle();
  if (!p) {
    console.error(`Aucun prospect « ${slug} »`);
    process.exit(1);
  }
  const { data: s } = await sb.from('ph_sites').select('repo').eq('prospect_id', p.id).maybeSingle();
  if (!s) {
    console.error('Site non créé : bouton « Créer le site » dans l’Atelier.');
    process.exit(1);
  }
  mkdirSync(sitesDir, { recursive: true });
  const dir = join(sitesDir, slug);
  if (existsSync(join(dir, '.git'))) {
    console.log(`↻ ${dir}`);
    execFileSync('git', ['pull', '--rebase', '--autostash'], { cwd: dir, stdio: 'inherit' });
  } else {
    console.log(`↓ ${owner}/${s.repo}`);
    execFileSync('gh', ['repo', 'clone', `${owner}/${s.repo}`, dir], { stdio: 'inherit' });
  }
  if (!existsSync(join(dir, 'node_modules'))) execFileSync('npm', ['install', '--no-fund', '--no-audit'], { cwd: dir, stdio: 'inherit' });
  console.log(`\n${p.name} · /brand → /directions → /build → /humanize → /audit → /ship\n`);
  const child = spawn('claude', [], { cwd: dir, stdio: 'inherit' });
  child.on('close', (code) => process.exit(code ?? 0));
}
