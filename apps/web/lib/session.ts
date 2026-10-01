import { createHmac, timingSafeEqual } from 'node:crypto';

/** Session propriétaire : cookie signé HMAC, sans dépendance à Supabase Auth. */
export const SESSION_COOKIE = 'ph_session';
const MAX_AGE = 30 * 24 * 3600;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET manquant (32 caractères minimum)');
  return s;
}

export function signSession(): { value: string; maxAge: number } {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return { value: `${payload}.${sig}`, maxAge: MAX_AGE };
}

export function verifySession(value: string | undefined | null): boolean {
  if (!value) return false;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return false;
  let expected: string;
  try {
    expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  } catch {
    return false;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number };
    return exp > Date.now();
  } catch {
    return false;
  }
}
