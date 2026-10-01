import raw from './cities.data.json';

export type City = { name: string; cp: string; dept: string; region: string; pop: number; lat: number; lng: number };

/** Communes françaises de 15 000 habitants et plus (source : geo.api.gouv.fr). */
export const CITIES: City[] = (raw as [string, string, string, string, number, number, number][]).map(
  ([name, cp, dept, region, pop, lat, lng]) => ({ name, cp, dept, region, pop, lat, lng }),
);

export const REGIONS: Record<string, string> = {
  '84': 'Auvergne-Rhône-Alpes', '27': 'Bourgogne-Franche-Comté', '53': 'Bretagne', '24': 'Centre-Val de Loire',
  '94': 'Corse', '44': 'Grand Est', '32': 'Hauts-de-France', '11': 'Île-de-France', '28': 'Normandie',
  '75': 'Nouvelle-Aquitaine', '76': 'Occitanie', '52': 'Pays de la Loire', '93': "Provence-Alpes-Côte d'Azur",
  '01': 'Guadeloupe', '02': 'Martinique', '03': 'Guyane', '04': 'La Réunion', '06': 'Mayotte',
};

export type Zone = { kind: 'france' } | { kind: 'regions'; codes: string[] } | { kind: 'departements'; codes: string[] };

export function citiesForZone(zone: Zone, minPop = 15_000): City[] {
  const base = CITIES.filter((c) => c.pop >= minPop);
  if (zone.kind === 'france') return base;
  if (zone.kind === 'regions') return base.filter((c) => zone.codes.includes(c.region));
  return base.filter((c) => zone.codes.includes(c.dept));
}
