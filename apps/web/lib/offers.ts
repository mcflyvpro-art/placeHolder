import type { Offers } from '@ph/core';

export type PricingState = {
  pages: number;
  options: string[];
  overrides?: Partial<{ oneOff: number; setup: number; hybridMonthly: number; subMonthly: number }>;
  computed?: Offers;
};

export type Effective = { oneOff: number; setup: number; hybridMonthly: number; subMonthly: number };

/** Prix effectifs (calcul + ajustements manuels) — partagé entre la fiche et le devis. */
export function effectiveOffers(pricing: PricingState | null): Effective | null {
  const c = pricing?.computed;
  if (!c) return null;
  const o = pricing?.overrides ?? {};
  return {
    oneOff: o.oneOff ?? c.oneOff.price,
    setup: o.setup ?? c.hybrid.setup,
    hybridMonthly: o.hybridMonthly ?? c.hybrid.monthly,
    subMonthly: o.subMonthly ?? c.subscription.monthly,
  };
}
