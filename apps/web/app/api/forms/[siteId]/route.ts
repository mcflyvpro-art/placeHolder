import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyTurnstile } from '@/lib/integrations/cloudflare';
import { sendMail } from '@/lib/integrations/mailer';

function cors(origin: string | null, allowed: string[]) {
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

async function allowedOrigins(siteId: string) {
  const sb = supabaseAdmin();
  const { data: site } = await sb.from('sites').select('id, preview_url, production_domain, pages_project, turnstile_secret, form_email, prospect_id, mode').eq('id', siteId).maybeSingle();
  if (!site) return { site: null, origins: [] as string[] };
  const origins = [site.preview_url && new URL(site.preview_url).origin, `https://${site.pages_project}.pages.dev`];
  if (site.production_domain) origins.push(`https://${site.production_domain}`, `https://www.${site.production_domain}`);
  return { site, origins: origins.filter(Boolean) as string[] };
}

export async function OPTIONS(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const { origins } = await allowedOrigins(siteId);
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin'), origins) });
}

export async function POST(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const { site, origins } = await allowedOrigins(siteId);
  const headers = cors(req.headers.get('origin'), origins);
  if (!site || site.mode === 'suspended') return NextResponse.json({ error: 'site' }, { status: 404, headers });

  const form = await req.formData();
  const field = (k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max);
  if (field('website', 10)) return NextResponse.json({ ok: true }, { headers }); // pot de miel
  const payload = { name: field('name', 120), email: field('email', 200), phone: field('phone', 40), message: field('message', 4000) };
  if (!payload.name || !payload.message || !/^\S+@\S+\.\S+$/.test(payload.email)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers });
  }
  if (site.turnstile_secret) {
    const ok = await verifyTurnstile(site.turnstile_secret, field('cf-turnstile-response', 4096), req.headers.get('x-forwarded-for')?.split(',')[0]);
    if (!ok) return NextResponse.json({ error: 'captcha' }, { status: 400, headers });
  }

  const sb = supabaseAdmin();
  const { data: msg } = await sb.from('form_messages').insert({ site_id: site.id, payload }).select('id').single();
  const { data: p } = await sb.from('prospects').select('name, client_email').eq('id', site.prospect_id).single();
  const to = site.form_email ?? p?.client_email;
  if (to) {
    const sent = await sendMail({
      to,
      replyTo: payload.email,
      subject: `Nouveau message de ${payload.name} — ${p?.name ?? 'votre site'}`,
      text: `${payload.message}\n\n—\n${payload.name}\n${payload.email}${payload.phone ? `\n${payload.phone}` : ''}\n\nMessage reçu via le formulaire de votre site.`,
    }).catch(() => false);
    if (sent && msg) await sb.from('form_messages').update({ forwarded: true }).eq('id', msg.id);
  }
  return NextResponse.json({ ok: true }, { headers });
}
