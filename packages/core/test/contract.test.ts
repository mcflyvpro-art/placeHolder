import { describe, expect, it } from 'vitest';
import { cgv, quoteLines } from '../src/contract';

const base = { pages: 5, options: [{ label: 'Formulaire de contact' }], oneOff: 900, setup: 540, hybridMonthly: 35, subMonthly: 70 };
const seller = { nom: 'Samuel François EI', siret: '12345678900011', adresse: 'Lyon', email: 'a@b.fr' };

describe('quoteLines', () => {
  it('création seule : total = prix, pas de mensualité', () => {
    const q = quoteLines({ offer: 'oneOff', ...base });
    expect(q.total).toBe(900);
    expect(q.monthly).toBeNull();
  });
  it('hybride : setup + mensualité 12 mois', () => {
    const q = quoteLines({ offer: 'hybrid', ...base });
    expect(q.total).toBe(540);
    expect(q.monthly).toBe(35);
    expect(q.commitment).toBe(12);
  });
  it('abonnement seul : rien à la création', () => {
    const q = quoteLines({ offer: 'subscription', ...base });
    expect(q.total).toBe(0);
    expect(q.monthly).toBe(70);
  });
});

describe('cgv', () => {
  it('cède les droits en création seule', () => {
    expect(cgv('oneOff', seller).find((x) => x.title === 'Propriété intellectuelle')!.body).toContain('cède');
  });
  it('ajoute la clause abonnement', () => {
    expect(cgv('hybrid', seller).some((x) => x.title === 'Abonnement')).toBe(true);
    expect(cgv('oneOff', seller).some((x) => x.title === 'Abonnement')).toBe(false);
  });
  it('mentionne la franchise de TVA', () => {
    expect(cgv('oneOff', seller).find((x) => x.title === 'Prix et paiement')!.body).toContain('293 B');
  });
});
