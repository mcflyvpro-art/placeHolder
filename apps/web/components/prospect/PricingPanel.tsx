'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { computeOffers, OPTIONS, type Grid, type Offers } from '@ph/core';
import { Chip, Group, inlineFieldClass } from '@/components/ui';
import { euro } from '@/lib/format';
import { updateProspect } from '@/app/(app)/actions';
import type { PricingState } from '@/lib/offers';
import s from './prospect.module.css';

export function PricingPanel({
  id,
  gridKey,
  grid,
  payScore,
  initial,
}: {
  id: string;
  gridKey: string;
  grid: Grid;
  payScore: number;
  initial: PricingState;
}) {
  const [state, setState] = useState<PricingState>(initial);
  const [, start] = useTransition();
  const first = useRef(true);

  const offers: Offers = useMemo(
    () => computeOffers({ pages: state.pages, options: state.options, sector: gridKey, payScore, grid }),
    [state.pages, state.options, gridKey, payScore, grid],
  );
  const o = state.overrides ?? {};

  // Sauvegarde différée : chaque modification persiste sans bouton.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => start(() => updateProspect(id, { pricing: { ...state, computed: offers } })), 500);
    return () => clearTimeout(t);
  }, [state, offers, id]);

  const set = (patch: Partial<PricingState>) => setState((x) => ({ ...x, ...patch }));
  const override = (k: keyof NonNullable<PricingState['overrides']>, v: string) => {
    const n = Number(v.replace(/[^\d]/g, ''));
    setState((x) => ({ ...x, overrides: { ...x.overrides, [k]: Number.isFinite(n) && v.trim() ? n : undefined } }));
  };

  const price = (k: keyof NonNullable<PricingState['overrides']>, value: number) => (
    <input
      className={`${inlineFieldClass} ${s.offerPrice}`}
      style={{ textAlign: 'left', color: 'var(--label)' }}
      defaultValue={o[k] ?? value}
      key={`${k}-${value}`}
      onBlur={(e) => override(k, e.target.value)}
      inputMode="numeric"
      aria-label="Prix"
    />
  );

  return (
    <Group title="Prix">
      <div className={s.aiRow} style={{ padding: '12px 16px 0' }}>
        <span>Pages</span>
        <div className={s.stepper}>
          <button type="button" onClick={() => set({ pages: Math.max(1, state.pages - 1) })} aria-label="Moins">−</button>
          <span>{state.pages}</span>
          <button type="button" onClick={() => set({ pages: Math.min(20, state.pages + 1) })} aria-label="Plus">+</button>
        </div>
      </div>
      <div className={s.options} style={{ paddingTop: 12 }}>
        {Object.entries(OPTIONS).map(([k, v]) => (
          <Chip key={k} on={state.options.includes(k)} onClick={() => set({ options: state.options.includes(k) ? state.options.filter((x) => x !== k) : [...state.options, k] })}>
            {v.label}
          </Chip>
        ))}
      </div>
      <div className={s.offers}>
        <div className={s.offer}>
          <span className="t-caption c2">Création seule</span>
          {price("oneOff", offers.oneOff.price)}
          <span className={s.offerSub}>Tout transféré au client</span>
        </div>
        <div className={s.offer}>
          <span className="t-caption c2">Création + abonnement</span>
          {price("setup", offers.hybrid.setup)}
          <span className={s.offerSub}>+ {euro(o.hybridMonthly ?? offers.hybrid.monthly)}/mois</span>
        </div>
        <div className={s.offer}>
          <span className="t-caption c2">Abonnement seul</span>
          {price("subMonthly", offers.subscription.monthly)}
          <span className={s.offerSub}>/mois · 12 mois</span>
        </div>
      </div>
    </Group>
  );
}
