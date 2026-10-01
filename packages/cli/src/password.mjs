import { randomBytes, scryptSync } from 'node:crypto';
import { db } from './db.mjs';

function ask(question) {
  // Saisie masquée.
  return new Promise((resolve) => {
    process.stdout.write(question);
    const { stdin } = process;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (ch === '\u0003') {
        process.exit(1);
      } else if (ch === '\u007f') {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

/** Définit le mot de passe de connexion à l'outil (haché scrypt, même format que l'app). */
export async function password() {
  const a = await ask('Nouveau mot de passe (12 caractères min.) : ');
  if (a.length < 12) throw new Error('Trop court');
  const b = await ask('Confirmer : ');
  if (a !== b) throw new Error('Les mots de passe diffèrent');
  const salt = randomBytes(16).toString('hex');
  const hash = `${salt}:${scryptSync(a, salt, 32).toString('hex')}`;
  const { error } = await db().from('ph_settings').update({ owner_password_hash: hash }).eq('id', true);
  if (error) throw new Error(error.message);
  console.log('Mot de passe enregistré.');
}
