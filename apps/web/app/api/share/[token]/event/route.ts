import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { advance, type Status } from '@ph/core';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/password';

/** Événements publics du lien de présentation : vue, j'aime, demande de modification, déverrouillage. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as { kind?: string; message?: string; device?: string; password?: string };
  const sb = supabaseAdmin();
  const { data: link } = await sb.from('share_links').select('id, prospect_id, expires_at, password_hash, active, views').eq('token', token).maybeSingle();
  if (!link || !link.active || new Date(link.expires_at) < new Date()) return NextResponse.json({ error: 'expired' }, { status: 410 });

  if (body.kind === 'unlock') {
    if (!link.password_hash || !verifyPassword(String(body.password ?? ''), link.password_hash)) {
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ error: 'password' }, { status: 403 });
    }
    (await cookies()).set(`ph_share_${link.id}`, 'ok', { httpOnly: true, secure: true, sameSite: 'lax', path: `/voir/${token}`, maxAge: 7 * 86400 });
    return NextResponse.json({ ok: true });
  }

  if (link.password_hash && (await cookies()).get(`ph_share_${link.id}`)?.value !== 'ok') {
    return NextResponse.json({ error: 'locked' }, { status: 403 });
  }

  const kind = body.kind === 'like' ? 'like' : body.kind === 'change_request' ? 'change_request' : 'view';
  const device = body.device === 'mobile' ? 'mobile' : 'ordinateur';
  const message = kind === 'change_request' ? String(body.message ?? '').trim().slice(0, 2000) : null;
  if (kind === 'change_request' && !message) return NextResponse.json({ error: 'empty' }, { status: 400 });

  await sb.from('share_events').insert({ link_id: link.id, kind, device, message });
  if (kind === 'view') await sb.from('share_links').update({ views: link.views + 1, last_view_at: new Date().toISOString() }).eq('id', link.id);
  await sb.from('activities').insert({
    prospect_id: link.prospect_id,
    kind: kind === 'view' ? 'share_view' : kind === 'like' ? 'share_like' : 'share_change',
    data: { device, message },
  });
  if (kind !== 'view') {
    const { data: p } = await sb.from('prospects').select('status').eq('id', link.prospect_id).single();
    if (p) await sb.from('prospects').update({ status: advance(p.status as Status, 'negociation'), next_action_at: new Date().toISOString() }).eq('id', link.prospect_id);
  }
  return NextResponse.json({ ok: true });
}
