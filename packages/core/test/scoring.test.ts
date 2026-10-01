import { describe, expect, it } from 'vitest';
import { needScore, payScore, priority } from '../src/scoring';
import type { SiteAudit } from '../src/audit';

const goodAudit: SiteAudit = {
  reachable: true,
  https: true,
  viewport: true,
  title: 'Plomberie Martin',
  description: 'Dépannage',
  copyrightYear: 2025,
  generator: null,
  freeDomain: false,
  legalPage: true,
  socials: [],
  themeColor: null,
  ogImage: null,
  favicon: null,
  isSocialOnly: false,
};

describe('needScore', () => {
  it('vaut 100 sans site', () => {
    expect(needScore({ website: null, audit: null, pagespeed: null }).score).toBe(100);
  });

  it('vaut 100 pour une page Facebook seule', () => {
    const r = needScore({
      website: 'https://facebook.com/plombier',
      audit: { ...goodAudit, isSocialOnly: true },
      pagespeed: null,
    });
    expect(r.score).toBe(100);
    expect(r.reasons).toContain('Réseau social seulement');
  });

  it('vaut 0 pour un site correct', () => {
    expect(needScore({ website: 'https://a.fr', audit: goodAudit, pagespeed: 90 }).score).toBe(0);
  });

  it('additionne les défauts', () => {
    const r = needScore({
      website: 'http://a.fr',
      audit: { ...goodAudit, https: false, viewport: false, copyrightYear: 2016 },
      pagespeed: 40,
    });
    expect(r.score).toBe(20 + 25 + 15 + 15);
    expect(r.reasons).toEqual(['Pas de HTTPS', 'Pas adapté mobile', 'Lent sur mobile (40)', '© 2016']);
  });

  it('plafonne à 100', () => {
    const r = needScore({
      website: 'http://a.fr',
      audit: { ...goodAudit, reachable: false, https: false, viewport: false },
      pagespeed: 10,
    });
    expect(r.score).toBe(100);
  });
});

describe('payScore', () => {
  const now = new Date('2026-10-01');

  it('part de 30', () => {
    const r = payScore({
      trancheEffectif: null, ca: null, dateCreation: null, reviews: null, rating: null,
      sectorTier: 'mid', entrepreneurIndividuel: false, now,
    });
    expect(r.score).toBe(30);
  });

  it('récompense effectif, CA, ancienneté, avis et secteur', () => {
    const r = payScore({
      trancheEffectif: '03', ca: 350_000, dateCreation: '2015-01-01', reviews: 120, rating: 4.7,
      sectorTier: 'high', entrepreneurIndividuel: false, now,
    });
    expect(r.score).toBe(100);
  });

  it('pénalise un EI sans salarié de moins d’un an', () => {
    const r = payScore({
      trancheEffectif: 'NN', ca: null, dateCreation: '2026-03-01', reviews: 2, rating: 5,
      sectorTier: 'low', entrepreneurIndividuel: true, now,
    });
    expect(r.score).toBe(5);
    expect(r.reasons).toContain('Indépendant récent sans salarié');
  });

  it('pénalise une mauvaise note', () => {
    const r = payScore({
      trancheEffectif: null, ca: null, dateCreation: null, reviews: 15, rating: 3.1,
      sectorTier: 'mid', entrepreneurIndividuel: false, now,
    });
    expect(r.score).toBe(20);
    expect(r.reasons).toContain('Note Google 3,1');
  });
});

describe('priority', () => {
  it('multiplie et ramène sur 100', () => {
    expect(priority(80, 50)).toBe(40);
    expect(priority(100, 100)).toBe(100);
  });
});
