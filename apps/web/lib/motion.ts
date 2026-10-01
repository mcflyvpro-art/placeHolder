import type { Transition } from 'motion/react';

/**
 * Springs maison (Apple : damping + response).
 * `bounce 0` partout par défaut ; un peu de rebond uniquement après un geste avec élan.
 */
export const spring = {
  default: { type: 'spring', bounce: 0, duration: 0.4 } satisfies Transition,
  snappy: { type: 'spring', bounce: 0, duration: 0.28 } satisfies Transition,
  momentum: { type: 'spring', bounce: 0.2, duration: 0.4 } satisfies Transition,
  sheet: { type: 'spring', bounce: 0.15, duration: 0.32 } satisfies Transition,
  layout: { type: 'spring', bounce: 0, duration: 0.35 } satisfies Transition,
};

/** Projection de momentum (Designing Fluid Interfaces, WWDC18). v en px/s. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Résistance progressive au-delà d'une limite. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
