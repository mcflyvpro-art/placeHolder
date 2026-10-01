import 'server-only';
import Stripe from 'stripe';
import { env } from '@/lib/env';

let client: Stripe | null = null;
export function stripe() {
  if (!env.stripeKey) throw new Error('STRIPE_SECRET_KEY absente');
  client ??= new Stripe(env.stripeKey);
  return client;
}

export type CheckoutKind = 'deposit' | 'balance' | 'one_off' | 'subscription';

/** Session Checkout : paiement unique (acompte/solde) ou abonnement mensuel. Montants en euros. */
export async function createCheckout(o: {
  kind: CheckoutKind;
  quoteId: string;
  prospectId: string;
  label: string;
  amount: number;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
  commitmentMonths?: number | null;
}) {
  const s = stripe();
  const metadata = { kind: o.kind, quote_id: o.quoteId, prospect_id: o.prospectId };
  const cents = Math.round(o.amount * 100);
  if (o.kind === 'subscription') {
    return s.checkout.sessions.create({
      mode: 'subscription',
      locale: 'fr',
      customer_email: o.email ?? undefined,
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: cents, recurring: { interval: 'month' }, product_data: { name: o.label } } }],
      subscription_data: { metadata },
      metadata,
      success_url: o.successUrl,
      cancel_url: o.cancelUrl,
    });
  }
  return s.checkout.sessions.create({
    mode: 'payment',
    locale: 'fr',
    customer_email: o.email ?? undefined,
    customer_creation: 'always',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: cents, product_data: { name: o.label } } }],
    payment_intent_data: { metadata },
    metadata,
    success_url: o.successUrl,
    cancel_url: o.cancelUrl,
  });
}
