import { describe, expect, it } from 'vitest';
import { computeOffers, DEFAULT_GRID, adjustGrid } from '../src/pricing';
import { formatNumber } from '../src/numbering';
import { parseSiteHtml } from '../src/audit';
import { pickSirenMatch, nameSimilarity } from '../src/matching';
import { exclusionReason } from '../src/exclusions';
import { contrastRatio, ensureAA } from '../src/contrast';
import { legalDocs } from '../src/legal';
import { slugify } from '../src/slug';
import { callOutcomeToStatus, advance, nextStage, LEGACY_STATUS } from '../src/pipeline';

describe('pricing', () => {
  it('produit 3 offres arrondies', () => {
    const o = computeOffers({ pages: 5, options: ['form'], sector: 'btp', payScore: 50, grid: DEFAULT_GRID });
    expect(o.oneOff.price % 10).toBe(0);
    expect(o.hybrid.setup).toBe(Math.round((o.oneOff.price * 0.6) / 10) * 10);
    expect(o.hybrid.monthly).toBeGreaterThanOrEqual(25);
    expect(o.hybrid.monthly).toBeLessThanOrEqual(45);
    expect(o.subscription.commitmentMonths).toBe(12);
    expect(o.subscription.monthly).toBeGreaterThan(o.hybrid.monthly);
  });

  it('augmente avec la capacité à payer', () => {
    const lo = computeOffers({ pages: 5, options: [], sector: 'btp', payScore: 0, grid: DEFAULT_GRID });
    const hi = computeOffers({ pages: 5, options: [], sector: 'btp', payScore: 100, grid: DEFAULT_GRID });
    expect(hi.oneOff.price).toBeGreaterThan(lo.oneOff.price);
  });

  it('ajuste la grille vers le prix accepté', () => {
    const g = adjustGrid(DEFAULT_GRID, 'btp', 5, 1000);
    const before = DEFAULT_GRID.btp!.perPage;
    expect(g.btp!.perPage).toBeCloseTo(before * 0.7 + 200 * 0.3);
  });
});

describe('numbering', () => {
  it('formate les numéros', () => {
    expect(formatNumber('D', 2026, 7)).toBe('D-2026-007');
    expect(formatNumber('F', 2026, 1234)).toBe('F-2026-1234');
  });
});

describe('parseSiteHtml', () => {
  it('détecte les défauts courants', () => {
    const html = `<html><head><meta name="generator" content="Wix.com Website Builder">
      <title>Chez Paul</title></head><body>
      <a href="https://www.facebook.com/chezpaul">fb</a>
      <footer>© 2017 Chez Paul</footer></body></html>`;
    const a = parseSiteHtml(html, 'http://chezpaul.wixsite.com/site');
    expect(a.https).toBe(false);
    expect(a.viewport).toBe(false);
    expect(a.copyrightYear).toBe(2017);
    expect(a.generator).toBe('Wix');
    expect(a.freeDomain).toBe(true);
    expect(a.legalPage).toBe(false);
    expect(a.socials).toEqual(['facebook']);
    expect(a.description).toBeNull();
  });

  it('reconnait un site propre', () => {
    const html = `<html><head><meta name="viewport" content="width=device-width">
      <meta name="description" content="x"><meta name="theme-color" content="#123456">
      <title>A</title></head><body><a href="/mentions-legales">Mentions légales</a> © 2019-2026</body></html>`;
    const a = parseSiteHtml(html, 'https://a.fr/');
    expect(a.viewport).toBe(true);
    expect(a.legalPage).toBe(true);
    expect(a.copyrightYear).toBe(2026);
    expect(a.themeColor).toBe('#123456');
  });

  it('marque les réseaux sociaux comme non-site', () => {
    expect(parseSiteHtml('<html></html>', 'https://www.facebook.com/x').isSocialOnly).toBe(true);
    expect(parseSiteHtml('<html></html>', 'https://www.pagesjaunes.fr/pros/1').isSocialOnly).toBe(true);
  });
});

describe('matching', () => {
  it('compare des noms', () => {
    expect(nameSimilarity('SARL Plomberie Martin', 'PLOMBERIE MARTIN')).toBeGreaterThan(0.9);
    expect(nameSimilarity('Boulangerie Dupont', 'Garage Leroy')).toBeLessThan(0.3);
  });

  it('choisit le bon SIREN', () => {
    const m = pickSirenMatch(
      { name: 'Plomberie Martin', postalCode: '69003', lat: 45.76, lng: 4.85 },
      [
        { siren: '111', names: ['GARAGE LEROY'], postalCode: '69003', lat: 45.76, lng: 4.85 },
        { siren: '222', names: ['MARTIN JEAN', 'PLOMBERIE MARTIN'], postalCode: '69003', lat: 45.7601, lng: 4.8501 },
      ],
    );
    expect(m?.siren).toBe('222');
  });

  it('refuse un match trop faible', () => {
    expect(
      pickSirenMatch({ name: 'Le Fournil', postalCode: '75001', lat: 48.8, lng: 2.3 },
        [{ siren: '1', names: ['TRANSPORTS X'], postalCode: '13001', lat: 43.3, lng: 5.4 }]),
    ).toBeNull();
  });
});

describe('exclusions', () => {
  const base = { naf: '43.22A', natureJuridique: '5710', etat: 'A', businessStatus: 'OPERATIONAL', chain: false, procedure: false };
  it('laisse passer un artisan', () => expect(exclusionReason(base)).toBeNull());
  it('exclut les professions réglementées', () => expect(exclusionReason({ ...base, naf: '86.21Z' })).toBe('Profession réglementée'));
  it('exclut les associations', () => expect(exclusionReason({ ...base, natureJuridique: '9220' })).toBe('Association'));
  it('exclut les fermées', () => expect(exclusionReason({ ...base, businessStatus: 'CLOSED_PERMANENTLY' })).toBe('Fermé'));
  it('exclut les procédures', () => expect(exclusionReason({ ...base, procedure: true })).toBe('Procédure collective'));
});

describe('contrast', () => {
  it('calcule le ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
  it('corrige vers AA', () => {
    const fixed = ensureAA('#ffcc00', '#ffffff');
    expect(contrastRatio(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('legal', () => {
  it('génère les mentions avec les manques signalés', () => {
    const d = legalDocs({
      denomination: 'Plomberie Martin', formeJuridique: 'SARL', capital: null, siege: '1 rue A, 69003 Lyon',
      siren: '123456789', registre: 'RCS Lyon', tva: null, directeurPublication: 'Jean Martin',
      email: 'contact@pm.fr', telephone: '04 00 00 00 00', mediateur: null, b2c: true,
    });
    expect(d.mentions).toContain('123 456 789');
    expect(d.mentions).toContain('[À COMPLÉTER: capital social]');
    expect(d.mentions).toContain('[À COMPLÉTER: médiateur de la consommation]');
    expect(d.cookies).toContain('aucun cookie');
  });
});

describe('slug & pipeline', () => {
  it('slugifie', () => expect(slugify('Plomberie Martin & Fils — Lyon')).toBe('plomberie-martin-fils-lyon'));
  it('mappe les résultats d’appel', () => {
    expect(callOutcomeToStatus('interested')).toBe('rdv');
    expect(callOutcomeToStatus('callback')).toBe('appel');
    expect(callOutcomeToStatus('not_interested')).toBe('perdu');
    expect(callOutcomeToStatus('no_answer')).toBe('appel');
  });
  it('n’avance jamais à reculons et ne ressuscite pas un perdu', () => {
    expect(advance('rdv', 'maquette')).toBe('rdv');
    expect(advance('maquette', 'appel')).toBe('appel');
    expect(advance('perdu', 'deal')).toBe('perdu');
    expect(advance('appel', 'perdu')).toBe('perdu');
  });
  it('donne l’étape suivante', () => {
    expect(nextStage('a_creer')).toBe('maquette');
    expect(nextStage('client')).toBeNull();
    expect(nextStage('perdu')).toBeNull();
  });
  it('migre les anciens statuts', () => {
    expect(LEGACY_STATUS.interesse).toBe('rdv');
    expect(LEGACY_STATUS.abonnement_actif).toBe('client');
  });
});
