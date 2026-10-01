#!/usr/bin/env node
import { site } from '../src/site.mjs';
import { worker } from '../src/worker.mjs';
import { login } from '../src/login.mjs';
import { db } from '../src/db.mjs';

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'site':
    await site(args[0]);
    break;
  case 'worker':
    await worker({ once: args.includes('--once') });
    break;
  case 'login':
    await login();
    break;
  case 'status': {
    const { data } = await db().from('ai_jobs').select('type, status').in('status', ['queued', 'running']);
    console.log(`${data?.length ?? 0} tâche(s) IA en attente`);
    break;
  }
  default:
    console.log(`ph — placeHolder

  ph login           configurer l'accès (trousseau macOS)
  ph site <slug>     ouvrir le site d'un client dans Claude Code
  ph worker          traiter les analyses IA demandées depuis l'outil
  ph status          état de la file IA`);
}
