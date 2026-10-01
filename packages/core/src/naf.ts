export type SectorTier = 'high' | 'mid' | 'low';

export type Sector = {
  key: string;
  label: string;
  group: string;
  keywords: string[];
  naf: string[];
  tier: SectorTier;
  schemaType: string;
  defaultPages: number;
  b2c: boolean;
};

export const SECTORS: Sector[] = [
  { key: 'plombier', label: 'Plombier chauffagiste', group: 'Bâtiment', keywords: ['plombier', 'chauffagiste'], naf: ['43.22A', '43.22B'], tier: 'high', schemaType: 'Plumber', defaultPages: 5, b2c: true },
  { key: 'electricien', label: 'Électricien', group: 'Bâtiment', keywords: ['électricien'], naf: ['43.21A'], tier: 'high', schemaType: 'Electrician', defaultPages: 5, b2c: true },
  { key: 'menuisier', label: 'Menuisier', group: 'Bâtiment', keywords: ['menuisier', 'ébéniste'], naf: ['43.32A', '16.23Z', '31.09B'], tier: 'high', schemaType: 'HomeAndConstructionBusiness', defaultPages: 6, b2c: true },
  { key: 'macon', label: 'Maçon', group: 'Bâtiment', keywords: ['maçon', 'maçonnerie'], naf: ['43.99C', '41.20A'], tier: 'high', schemaType: 'GeneralContractor', defaultPages: 5, b2c: true },
  { key: 'couvreur', label: 'Couvreur', group: 'Bâtiment', keywords: ['couvreur', 'charpentier'], naf: ['43.91A', '43.91B'], tier: 'high', schemaType: 'RoofingContractor', defaultPages: 5, b2c: true },
  { key: 'peintre', label: 'Peintre en bâtiment', group: 'Bâtiment', keywords: ['peintre en bâtiment'], naf: ['43.34Z'], tier: 'mid', schemaType: 'HousePainter', defaultPages: 5, b2c: true },
  { key: 'paysagiste', label: 'Paysagiste', group: 'Bâtiment', keywords: ['paysagiste'], naf: ['81.30Z'], tier: 'high', schemaType: 'HomeAndConstructionBusiness', defaultPages: 6, b2c: true },
  { key: 'serrurier', label: 'Serrurier', group: 'Bâtiment', keywords: ['serrurier'], naf: ['43.32B'], tier: 'mid', schemaType: 'Locksmith', defaultPages: 4, b2c: true },
  { key: 'cuisiniste', label: 'Cuisiniste', group: 'Bâtiment', keywords: ['cuisiniste'], naf: ['47.59A', '43.32A'], tier: 'high', schemaType: 'HomeGoodsStore', defaultPages: 6, b2c: true },
  { key: 'garage', label: 'Garage automobile', group: 'Auto', keywords: ['garage automobile', 'mécanicien auto'], naf: ['45.20A', '45.20B'], tier: 'high', schemaType: 'AutoRepair', defaultPages: 5, b2c: true },
  { key: 'carrosserie', label: 'Carrossier', group: 'Auto', keywords: ['carrosserie'], naf: ['45.20A'], tier: 'high', schemaType: 'AutoBodyShop', defaultPages: 5, b2c: true },
  { key: 'restaurant', label: 'Restaurant', group: 'Restauration', keywords: ['restaurant'], naf: ['56.10A'], tier: 'mid', schemaType: 'Restaurant', defaultPages: 4, b2c: true },
  { key: 'boulangerie', label: 'Boulangerie pâtisserie', group: 'Restauration', keywords: ['boulangerie', 'pâtisserie'], naf: ['10.71C', '10.71D', '47.24Z'], tier: 'low', schemaType: 'Bakery', defaultPages: 4, b2c: true },
  { key: 'traiteur', label: 'Traiteur', group: 'Restauration', keywords: ['traiteur'], naf: ['56.21Z'], tier: 'mid', schemaType: 'FoodEstablishment', defaultPages: 5, b2c: true },
  { key: 'coiffeur', label: 'Coiffeur', group: 'Beauté', keywords: ['coiffeur', 'salon de coiffure'], naf: ['96.02A'], tier: 'mid', schemaType: 'HairSalon', defaultPages: 4, b2c: true },
  { key: 'esthetique', label: 'Institut de beauté', group: 'Beauté', keywords: ['institut de beauté', 'esthéticienne'], naf: ['96.02B'], tier: 'mid', schemaType: 'BeautySalon', defaultPages: 5, b2c: true },
  { key: 'barbier', label: 'Barbier', group: 'Beauté', keywords: ['barbier'], naf: ['96.02A'], tier: 'mid', schemaType: 'HairSalon', defaultPages: 4, b2c: true },
  { key: 'tatoueur', label: 'Tatoueur', group: 'Beauté', keywords: ['tatoueur', 'salon de tatouage'], naf: ['96.09Z'], tier: 'mid', schemaType: 'TattooParlor', defaultPages: 5, b2c: true },
  { key: 'fleuriste', label: 'Fleuriste', group: 'Commerce', keywords: ['fleuriste'], naf: ['47.76Z'], tier: 'low', schemaType: 'Florist', defaultPages: 4, b2c: true },
  { key: 'photographe', label: 'Photographe', group: 'Services', keywords: ['photographe'], naf: ['74.20Z'], tier: 'mid', schemaType: 'ProfessionalService', defaultPages: 6, b2c: true },
  { key: 'demenageur', label: 'Déménageur', group: 'Services', keywords: ['déménageur'], naf: ['49.42Z'], tier: 'high', schemaType: 'MovingCompany', defaultPages: 5, b2c: true },
  { key: 'nettoyage', label: 'Entreprise de nettoyage', group: 'Services', keywords: ['entreprise de nettoyage'], naf: ['81.21Z', '81.22Z'], tier: 'mid', schemaType: 'ProfessionalService', defaultPages: 5, b2c: false },
  { key: 'immobilier', label: 'Agence immobilière', group: 'Services', keywords: ['agence immobilière'], naf: ['68.31Z'], tier: 'high', schemaType: 'RealEstateAgent', defaultPages: 6, b2c: true },
  { key: 'coach', label: 'Coach sportif', group: 'Santé & sport', keywords: ['coach sportif', 'salle de sport'], naf: ['93.13Z', '85.51Z'], tier: 'mid', schemaType: 'SportsActivityLocation', defaultPages: 5, b2c: true },
  { key: 'osteo', label: 'Ostéopathe', group: 'Santé & sport', keywords: ['ostéopathe'], naf: ['86.90E'], tier: 'mid', schemaType: 'MedicalBusiness', defaultPages: 4, b2c: true },
  { key: 'veterinaire', label: 'Toiletteur', group: 'Animaux', keywords: ['toiletteur canin'], naf: ['96.09Z'], tier: 'low', schemaType: 'PetStore', defaultPages: 4, b2c: true },
  { key: 'artisan_art', label: 'Artisan d’art', group: 'Commerce', keywords: ['artisan d\'art', 'atelier céramique'], naf: ['23.41Z', '32.12Z', '90.03A'], tier: 'mid', schemaType: 'Store', defaultPages: 5, b2c: true },
];

/** NAF dont la publicité est limitée par la loi ou la déontologie. */
export const REGULATED_NAF = new Set([
  '86.21Z', '86.22A', '86.22B', '86.22C', '86.23Z', // médecins, dentistes
  '69.10Z', // avocats, notaires, huissiers
  '47.73Z', // pharmacies
  '75.00Z', // vétérinaires
  '86.90A', '86.90B', // ambulances, laboratoires
]);

export function sectorByKey(key: string): Sector | undefined {
  return SECTORS.find((s) => s.key === key);
}

export function sectorByNaf(naf: string | null): Sector | undefined {
  if (!naf) return undefined;
  return SECTORS.find((s) => s.naf.includes(naf));
}
