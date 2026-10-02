import { beforeAll, describe, expect, it } from 'vitest';
import { signSession, verifySession } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/password';
import { mapPlace } from '@/lib/sources/google';
import { mapCompany } from '@/lib/sources/gouv';
import { planTasks } from '@/lib/radar';
import { effectiveOffers } from '@/lib/offers';
import { buildBrief, formeJuridique } from '@/lib/sitebrief';

beforeAll(() => {
  process.env.SESSION_SECRET = 'x'.repeat(40);
  process.env.APP_URL = 'https://app.test';
});

describe('session', () => {
  it('signe et vérifie', () => {
    expect(verifySession(signSession().value)).toBe(true);
  });
  it('refuse une signature altérée', () => {
    const v = signSession().value;
    expect(verifySession(v.slice(0, -2) + 'aa')).toBe(false);
    expect(verifySession('abc')).toBe(false);
    expect(verifySession(undefined)).toBe(false);
  });
});

describe('password', () => {
  it('vérifie un hash scrypt', () => {
    const h = hashPassword('correct horse battery');
    expect(verifyPassword('correct horse battery', h)).toBe(true);
    expect(verifyPassword('wrong', h)).toBe(false);
  });
});

describe('google.mapPlace', () => {
  it('extrait code postal et ville', () => {
    const p = mapPlace({
      id: 'abc',
      displayName: { text: 'Plomberie Martin' },
      addressComponents: [
        { longText: '69003', types: ['postal_code'] },
        { longText: 'Lyon', types: ['locality'] },
      ],
      location: { latitude: 45.76, longitude: 4.85 },
      nationalPhoneNumber: '04 78 00 00 00',
      userRatingCount: 42,
      rating: 4.6,
    });
    expect(p).toMatchObject({ name: 'Plomberie Martin', postalCode: '69003', city: 'Lyon', reviews: 42, website: null });
  });
  it('tolère un composant d’adresse sans types', () => {
    const p = mapPlace({ id: 'x', addressComponents: [{ longText: 'France' }, { longText: '69001', types: ['postal_code'] }] });
    expect(p.postalCode).toBe('69001');
  });
});

describe('gouv.mapCompany', () => {
  it('prend le dernier CA publié et repère les EI', () => {
    const c = mapCompany({
      siren: '123456789',
      nom_complet: 'MARTIN JEAN',
      nature_juridique: '1000',
      finances: { '2022': { ca: 90000 }, '2023': { ca: 120000 } },
      siege: { siret: '12345678900011', code_postal: '69003', latitude: '45.7', longitude: '4.8', liste_enseignes: ['PLOMBERIE MARTIN'] },
    });
    expect(c.ca).toBe(120000);
    expect(c.entrepreneurIndividuel).toBe(true);
    expect(c.names).toContain('PLOMBERIE MARTIN');
  });
});

describe('radar.planTasks', () => {
  it('respecte le budget et commence par les grandes villes', () => {
    const t = planTasks(['plombier'], { kind: 'france' }, 5);
    expect(t).toHaveLength(5);
    expect(t[0]!.city).toBe('Paris');
  });
  it('filtre par département', () => {
    const t = planTasks(['plombier', 'coiffeur'], { kind: 'departements', codes: ['69'] }, 100);
    expect(t.every((x) => x.cp.startsWith('69'))).toBe(true);
    expect(new Set(t.map((x) => x.sector)).size).toBe(2);
  });
});

describe('offers', () => {
  it('applique les ajustements manuels', () => {
    const e = effectiveOffers({
      pages: 5,
      options: [],
      computed: { oneOff: { price: 800 }, hybrid: { setup: 480, monthly: 35 }, subscription: { monthly: 70, commitmentMonths: 12 } },
      overrides: { oneOff: 950 },
    });
    expect(e).toEqual({ oneOff: 950, setup: 480, hybridMonthly: 35, subMonthly: 70 });
  });
});

describe('sitebrief', () => {
  it('construit brief et mentions légales', () => {
    expect(formeJuridique('5710')).toBe('SAS');
    const { brief, legal } = buildBrief(
      { name: 'Plomberie Martin', slug: 'plomberie-martin-lyon', sector: 'plombier', siren: '123456789', nature_juridique: '5499', address: '1 rue A, 69003 Lyon', phone: '0478000000', dirigeants: [{ nom: 'MARTIN', prenoms: 'Jean' }] },
      { id: 'site1', pages_project: 'ph-plomberie', preview_url: 'https://ph-plomberie.pages.dev', production_domain: null, turnstile_sitekey: null, analytics_token: null },
    );
    expect(brief.forms.endpoint).toBe('https://app.test/api/forms/site1');
    expect(brief.schemaType).toBe('Plumber');
    expect(legal.mentions).toContain('123 456 789');
    expect(legal.mentions).toContain('Jean MARTIN');
    expect(legal.mentions).toContain('[À COMPLÉTER: capital social]');
  });
});
