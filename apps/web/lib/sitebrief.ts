import 'server-only';
import { legalDocs, sectorByKey, type LegalBrief, type SiteAudit } from '@ph/core';
import { env } from '@/lib/env';

const FORMES: Record<string, string> = {
  '1000': 'Entrepreneur individuel', '5498': 'EURL', '5499': 'SARL', '5410': 'SARL', '5422': 'SARL', '5485': 'SELARL',
  '5710': 'SAS', '5720': 'SASU', '5599': 'SA', '5785': 'SELAS', '6540': 'SCI', '5202': 'SNC',
};

export const formeJuridique = (code: string | null) => (code ? FORMES[code] ?? null : null);

type Prospect = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Site = { pages_project: string; preview_url: string | null; production_domain: string | null; turnstile_sitekey: string | null; analytics_token: string | null; id: string };

export function buildBrief(p: Prospect, site: Site) {
  const sector = sectorByKey(p.sector ?? '');
  const audit = p.audit as SiteAudit | null;
  const dirigeants = (p.dirigeants ?? []) as { nom?: string; prenoms?: string; qualite?: string; type_dirigeant?: string }[];
  const person = dirigeants.find((d) => d.nom);
  const individuel = p.entrepreneur_individuel || p.nature_juridique === '1000';
  const legal: LegalBrief = {
    denomination: p.name,
    formeJuridique: formeJuridique(p.nature_juridique),
    capital: null,
    siege: p.address,
    siren: p.siren,
    registre: 'Immatriculée au Registre national des entreprises (RNE)',
    tva: null,
    directeurPublication: person ? `${person.prenoms ?? ''} ${person.nom ?? ''}`.trim() : null,
    email: p.client_email,
    telephone: p.phone,
    mediateur: null,
    b2c: sector?.b2c ?? true,
    individuel,
  };
  const analysis = p.ai_analysis as { pages?: string[]; services?: string[] } | null;
  const pricing = p.pricing as { options?: string[] } | null;

  const brief = {
    version: 1,
    slug: p.slug,
    name: p.name,
    sector: p.sector,
    sectorLabel: sector?.label ?? 'Entreprise',
    schemaType: sector?.schemaType ?? 'LocalBusiness',
    b2c: legal.b2c,
    domain: site.production_domain,
    previewUrl: site.preview_url,
    contact: {
      phone: p.phone,
      email: p.client_email,
      address: p.address,
      postalCode: p.postal_code,
      city: p.city,
      lat: p.lat,
      lng: p.lng,
      mapsUrl: p.maps_url,
    },
    hours: p.hours ?? [],
    legal,
    google: { rating: p.rating === null ? null : Number(p.rating), reviews: p.reviews },
    socials: audit?.socials ?? [],
    story: { since: p.date_creation, dirigeants: dirigeants.map((d) => ({ qualite: d.qualite, nom: [d.prenoms, d.nom].filter(Boolean).join(' ') })) },
    services: analysis?.services ?? [],
    pages: analysis?.pages ?? ['Accueil', 'Services', 'Réalisations', 'À propos', 'Contact'],
    options: pricing?.options ?? ['form'],
    analysis: p.ai_analysis ?? null,
    oldSite: { url: p.website, title: audit?.title ?? null, description: audit?.description ?? null },
    brand: { themeColor: audit?.themeColor ?? null, logo: null as string | null },
    analytics: { cloudflareToken: site.analytics_token },
    forms: { endpoint: `${env.appUrl}/api/forms/${site.id}`, turnstileSiteKey: site.turnstile_sitekey },
  };

  return { brief, legal: legalDocs(legal) };
}
