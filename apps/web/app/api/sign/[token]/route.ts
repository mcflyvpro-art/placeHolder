import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { signQuote } from '@/lib/closing';
import { createCheckout } from '@/lib/integrations/stripe';
import { env, integrations } from '@/lib/env';

/** GET : PDF du devis. POST {action:'sign', name} ou {action:'pay'}. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabaseAdmin();
  const { data: q } = await sb.from('ph_quotes').select('pdf_path').eq('sign_token', token).maybeSingle();
  if (!q?.pdf_path) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { data } = await sb.storage.from('ph-documents').createSignedUrl(q.pdf_path, 300);
  return data ? NextResponse.redirect(data.signedUrl) : NextResponse.json({ error: 'storage' }, { status: 500 });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: string; accept?: boolean };
  const sb = supabaseAdmin();

  if (body.action === 'sign') {
    if (!body.accept || !body.name || body.name.trim().length < 3) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      await signQuote(token, body.name, ip, req.headers.get('user-agent'));
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'erreur' }, { status: 400 });
    }
  }

  if (body.action === 'pay') {
    if (!integrations().stripe) return NextResponse.json({ error: 'stripe' }, { status: 503 });
    const { data: q } = await sb.from('ph_quotes').select('*').eq('sign_token', token).single();
    if (!q || q.status !== 'signed') return NextResponse.json({ error: 'not signed' }, { status: 400 });
    const back = `${env.appUrl}/signer/${token}`;
    const session =
      q.offer === 'subscription'
        ? await createCheckout({ kind: 'subscription', quoteId: q.id, prospectId: q.prospect_id, label: `Site ${q.client.denomination} — abonnement`, amount: Number(q.monthly), email: q.client.email, successUrl: `${back}?paid=1`, cancelUrl: back, commitmentMonths: q.commitment_months })
        : await createCheckout({ kind: 'deposit', quoteId: q.id, prospectId: q.prospect_id, label: `Acompte 30 % — devis ${q.number}`, amount: Math.round(Number(q.total) * Number(q.deposit_rate) * 100) / 100, email: q.client.email, successUrl: `${back}?paid=1`, cancelUrl: back });
    return NextResponse.json({ url: session.url });
  }
  return NextResponse.json({ error: 'action' }, { status: 400 });
}
