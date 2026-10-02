import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { advance, type Status } from '@ph/core';
import { env } from '@/lib/env';
import { stripe } from '@/lib/integrations/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { issueInvoice } from '@/lib/closing';

const LABEL: Record<string, string> = { deposit: 'Acompte 30 %', balance: 'Solde', one_off: 'Paiement', subscription: 'Abonnement mensuel' };

export async function POST(req: Request) {
  if (!env.stripeWebhookSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, req.headers.get('stripe-signature') ?? '', env.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: 'signature' }, { status: 400 });
  }
  const sb = supabaseAdmin();

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      const m = s.metadata ?? {};
      if (!m.prospect_id) break;
      if (s.mode === 'payment' && s.payment_status === 'paid') {
        const total = (s.amount_total ?? 0) / 100;
        const { data: q } = m.quote_id ? await sb.from('ph_quotes').select('number').eq('id', m.quote_id).single() : { data: null };
        await issueInvoice({
          prospectId: m.prospect_id,
          quoteId: m.quote_id ?? null,
          kind: (m.kind as 'deposit') ?? 'one_off',
          lines: [{ label: `${LABEL[m.kind ?? 'one_off']}${q ? ` — devis ${q.number}` : ''}`, qty: 1, unit: total }],
          total,
          paidAt: new Date().toISOString(),
          stripeRef: (s.payment_intent as string) ?? s.id,
        });
        const { data: p } = await sb.from('ph_prospects').select('status').eq('id', m.prospect_id).single();
        if (p) await sb.from('ph_prospects').update({ status: advance(p.status as Status, m.kind === 'deposit' ? 'deal' : 'client') }).eq('id', m.prospect_id);
      }
      if (s.mode === 'subscription' && s.subscription) {
        const sub = await stripe().subscriptions.retrieve(s.subscription as string);
        const { data: q } = m.quote_id ? await sb.from('ph_quotes').select('commitment_months').eq('id', m.quote_id).single() : { data: null };
        await sb.from('ph_subscriptions').upsert(
          {
            prospect_id: m.prospect_id,
            stripe_customer: s.customer as string,
            stripe_subscription: sub.id,
            monthly: (sub.items.data[0]?.price.unit_amount ?? 0) / 100,
            status: sub.status,
            current_period_end: sub.items.data[0]?.current_period_end ? new Date(sub.items.data[0].current_period_end * 1000).toISOString() : null,
            commitment_end: q?.commitment_months ? new Date(Date.now() + q.commitment_months * 30.4 * 864e5).toISOString().slice(0, 10) : null,
          },
          { onConflict: 'stripe_subscription' },
        );
        const { data: p } = await sb.from('ph_prospects').select('status').eq('id', m.prospect_id).single();
        if (p) await sb.from('ph_prospects').update({ status: advance(p.status as Status, 'client') }).eq('id', m.prospect_id);
      }
      break;
    }
    case 'invoice.paid': {
      const inv = event.data.object;
      const subId = (inv.parent?.subscription_details?.subscription as string | undefined) ?? null;
      if (!subId) break;
      const { data: sub } = await sb.from('ph_subscriptions').select('id, prospect_id').eq('stripe_subscription', subId).maybeSingle();
      const prospectId = sub?.prospect_id ?? (inv.parent?.subscription_details?.metadata?.prospect_id as string | undefined);
      if (!prospectId) break;
      const total = inv.amount_paid / 100;
      await issueInvoice({
        prospectId,
        quoteId: (inv.parent?.subscription_details?.metadata?.quote_id as string | undefined) ?? null,
        kind: 'subscription',
        lines: [{ label: `Abonnement mensuel — ${new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(inv.period_start * 1000))}`, qty: 1, unit: total }],
        total,
        paidAt: new Date().toISOString(),
        stripeRef: inv.id ?? null,
      });
      if (sub) await sb.from('ph_subscriptions').update({ unpaid_since: null, status: 'active' }).eq('id', sub.id);
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      const subId = inv.parent?.subscription_details?.subscription as string | undefined;
      if (subId) {
        const { data: sub } = await sb.from('ph_subscriptions').select('id, unpaid_since').eq('stripe_subscription', subId).maybeSingle();
        if (sub && !sub.unpaid_since) await sb.from('ph_subscriptions').update({ unpaid_since: new Date().toISOString(), status: 'past_due' }).eq('id', sub.id);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await sb.from('ph_subscriptions').update({ status: 'canceled' }).eq('stripe_subscription', sub.id);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
