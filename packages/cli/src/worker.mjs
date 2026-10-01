import { spawn } from 'node:child_process';
import { db } from './db.mjs';
import { prompt, schemas, extractJson } from './prompts.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runClaude(text) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'json'], { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claude a quitté avec le code ${code}`));
      try {
        const j = JSON.parse(out);
        resolve(j.result ?? out);
      } catch {
        resolve(out);
      }
    });
    child.stdin.end(text);
  });
}

async function claim(sb) {
  const { data: next } = await sb.from('ph_ai_jobs').select('id').eq('status', 'queued').order('created_at').limit(1).maybeSingle();
  if (!next) return null;
  const { data } = await sb
    .from('ph_ai_jobs')
    .update({ status: 'running', claimed_at: new Date().toISOString() })
    .eq('id', next.id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle();
  return data;
}

async function handle(sb, job) {
  const { data: p } = await sb.from('ph_prospects').select('*').eq('id', job.prospect_id).single();
  if (!p) throw new Error('Prospect supprimé');
  const text = await runClaude(prompt(job.type, p));
  const parsed = schemas[job.type].parse(extractJson(String(text)));
  if (job.type === 'analyse') await sb.from('ph_prospects').update({ ai_analysis: parsed }).eq('id', p.id);
  if (job.type === 'brand_dna') await sb.from('ph_prospects').update({ brand_dna: parsed.markdown }).eq('id', p.id);
  if (job.type === 'directions') await sb.from('ph_prospects').update({ directions: parsed.directions }).eq('id', p.id);
  return parsed;
}

export async function worker({ once = false } = {}) {
  const sb = db();
  console.log('ph worker · en attente de tâches (Ctrl+C pour arrêter)');
  for (;;) {
    const job = await claim(sb);
    if (!job) {
      if (once) return;
      await sleep(5000);
      continue;
    }
    const started = Date.now();
    process.stdout.write(`→ ${job.type} ${job.prospect_id.slice(0, 8)}… `);
    try {
      const result = await handle(sb, job);
      await sb.from('ph_ai_jobs').update({ status: 'done', result, finished_at: new Date().toISOString(), attempts: job.attempts + 1 }).eq('id', job.id);
      console.log(`ok (${Math.round((Date.now() - started) / 1000)} s)`);
    } catch (e) {
      const attempts = job.attempts + 1;
      await sb
        .from('ph_ai_jobs')
        .update({ status: attempts < 3 ? 'queued' : 'error', error: String(e.message ?? e).slice(0, 500), attempts })
        .eq('id', job.id);
      console.log(`échec (${attempts}/3) : ${e.message ?? e}`);
    }
  }
}
