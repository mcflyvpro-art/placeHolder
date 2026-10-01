import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Payload = { repo: string; sha: string; message: string; url: string; status: string; quality: Record<string, unknown> | null };

export async function POST(req: Request) {
  const secret = env.siteWebhookSecret;
  const raw = await req.text();
  const sig = req.headers.get('x-ph-signature') ?? '';
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: 'signature' }, { status: 401 });
  }
  const body = JSON.parse(raw) as Payload;
  const repo = body.repo.split('/').pop();
  const sb = supabaseAdmin();
  const { data: site } = await sb.from('ph_sites').select('id, prospect_id').eq('repo', repo).maybeSingle();
  if (!site) return NextResponse.json({ error: 'unknown repo' }, { status: 404 });
  await sb.from('ph_site_versions').insert({
    site_id: site.id,
    sha: body.sha,
    message: body.message,
    url: body.status === 'success' ? body.url : null,
    quality: body.quality ? { ...body.quality, deploy: body.status } : { deploy: body.status },
  });
  await sb.from('ph_activities').insert({
    prospect_id: site.prospect_id,
    kind: 'site',
    data: { text: `Version ${body.sha.slice(0, 7)} · ${body.message}${body.quality?.passed === false ? ' · qualité à revoir' : ''}` },
  });
  return NextResponse.json({ ok: true });
}
