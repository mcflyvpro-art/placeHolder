import 'server-only';

export type Company = {
  siren: string;
  siret: string | null;
  names: string[];
  naf: string | null;
  natureJuridique: string | null;
  etat: string | null;
  dateCreation: string | null;
  trancheEffectif: string | null;
  entrepreneurIndividuel: boolean;
  address: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  dirigeants: { nom?: string; prenoms?: string; qualite?: string; denomination?: string }[];
  ca: number | null;
  finances: Record<string, { ca?: number; resultat_net?: number }> | null;
  categorie: string | null;
};

type Raw = {
  siren: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  sigle?: string;
  activite_principale?: string;
  nature_juridique?: string;
  etat_administratif?: string;
  date_creation?: string;
  tranche_effectif_salarie?: string;
  categorie_entreprise?: string;
  complements?: { est_entrepreneur_individuel?: boolean };
  dirigeants?: Company['dirigeants'];
  finances?: Company['finances'];
  siege?: {
    siret?: string;
    adresse?: string;
    code_postal?: string;
    latitude?: string;
    longitude?: string;
    nom_commercial?: string | null;
    liste_enseignes?: string[] | null;
  };
  matching_etablissements?: { siret?: string; code_postal?: string; latitude?: string; longitude?: string; liste_enseignes?: string[] | null; nom_commercial?: string | null; etat_administratif?: string }[];
};

export function mapCompany(r: Raw, preferCp?: string | null): Company {
  const est = r.matching_etablissements?.find((e) => e.etat_administratif === 'A' && (!preferCp || e.code_postal === preferCp));
  const loc = est ?? r.siege;
  const names = [
    r.nom_complet, r.nom_raison_sociale, r.sigle, r.siege?.nom_commercial, est?.nom_commercial,
    ...(r.siege?.liste_enseignes ?? []), ...(est?.liste_enseignes ?? []),
  ].filter((x): x is string => !!x);
  const years = Object.keys(r.finances ?? {}).sort();
  const last = years.length ? r.finances![years[years.length - 1]!] : undefined;
  const num = (v?: string) => (v ? Number(v) : null);
  return {
    siren: r.siren,
    siret: est?.siret ?? r.siege?.siret ?? null,
    names: [...new Set(names)],
    naf: r.activite_principale ?? null,
    natureJuridique: r.nature_juridique ?? null,
    etat: r.etat_administratif ?? null,
    dateCreation: r.date_creation ?? null,
    trancheEffectif: r.tranche_effectif_salarie ?? null,
    entrepreneurIndividuel: !!r.complements?.est_entrepreneur_individuel || r.nature_juridique === '1000',
    address: r.siege?.adresse ?? null,
    postalCode: loc?.code_postal ?? null,
    lat: num(loc?.latitude),
    lng: num(loc?.longitude),
    dirigeants: r.dirigeants ?? [],
    ca: last?.ca ?? null,
    finances: r.finances ?? null,
    categorie: r.categorie_entreprise ?? null,
  };
}

export async function searchCompanies(name: string, postalCode: string | null): Promise<Company[]> {
  const url = new URL('https://recherche-entreprises.api.gouv.fr/search');
  url.searchParams.set('q', name);
  if (postalCode) url.searchParams.set('code_postal', postalCode);
  url.searchParams.set('per_page', '5');
  url.searchParams.set('etat_administratif', 'A');
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: Raw[] };
    return (json.results ?? []).map((r) => mapCompany(r, postalCode));
  }
  return [];
}

export async function companyBySiren(siren: string): Promise<Company | null> {
  const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siren}&per_page=1`, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: Raw[] };
  const r = json.results?.[0];
  return r && r.siren === siren ? mapCompany(r) : null;
}
