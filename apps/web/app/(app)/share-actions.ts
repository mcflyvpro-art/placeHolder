'use server';

import { randomBytes } from 'node:crypto';
import { advance, type Status } from '@ph/core';
import { requireOwner } from '@/lib/auth';
import { env } from '@/lib/env';
import { qrSvgDataUri } from '@/lib/qr';
import { hashPassword } from '@/lib/password';

export async function createShareLink(prospectId: string, days: number, password: string | null) {
  const sb = await requireOwner();
  const token = randomBytes(24).toString('base64url');
  await sb.from('share_links').update({ active: false }).eq('prospect_id', prospectId);
  await sb.from('share_links').insert({
    prospect_id: prospectId,
    token,
    expires_at: new Date(Date.now() + days * 864e5).toISOString(),
    password_hash: password ? hashPassword(password) : null,
  });
  const { data: p } = await sb.from('prospects').select('status').eq('id', prospectId).single();
  if (p) await sb.from('prospects').update({ status: advance(p.status as Status, 'maquette_envoyee') }).eq('id', prospectId);
  const url = `${env.appUrl}/voir/${token}`;
  return { url, qr: await qrSvgDataUri(url) };
}
