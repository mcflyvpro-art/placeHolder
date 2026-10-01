export type GridEntry = { perPage: number; monthly: number };
export type Grid = Record<string, GridEntry>;

export const OPTIONS: Record<string, { label: string; price: number }> = {
  form: { label: 'Formulaire de contact', price: 60 },
  gallery: { label: 'Galerie / réalisations', price: 90 },
  booking: { label: 'Prise de rendez-vous', price: 150 },
  menu: { label: 'Carte / menu', price: 80 },
  multilingual: { label: 'Version anglaise', price: 220 },
  blog: { label: 'Actualités', price: 160 },
  reviews: { label: 'Avis Google intégrés', price: 50 },
};

export const DEFAULT_GRID: Grid = {
  default: { perPage: 110, monthly: 29 },
  btp: { perPage: 130, monthly: 35 },
  auto: { perPage: 125, monthly: 35 },
  restauration: { perPage: 100, monthly: 29 },
  beaute: { perPage: 105, monthly: 29 },
  commerce: { perPage: 95, monthly: 25 },
  services: { perPage: 115, monthly: 32 },
  sante: { perPage: 110, monthly: 29 },
};

/** Groupe de secteur (Sector.group) → clé de grille. */
export function gridKey(group: string | undefined): string {
  const map: Record<string, string> = {
    'Bâtiment': 'btp', Auto: 'auto', Restauration: 'restauration', 'Beauté': 'beaute',
    Commerce: 'commerce', Services: 'services', 'Santé & sport': 'sante', Animaux: 'commerce',
  };
  return (group && map[group]) || 'default';
}

export type PricingInput = {
  pages: number;
  options: string[];
  sector: string;
  payScore: number;
  grid: Grid;
};

export type Offers = {
  oneOff: { price: number };
  hybrid: { setup: number; monthly: number };
  subscription: { monthly: number; commitmentMonths: 12 };
};

const round10 = (n: number) => Math.round(n / 10) * 10;
const round5 = (n: number) => Math.round(n / 5) * 5;

export function computeOffers({ pages, options, sector, payScore, grid }: PricingInput): Offers {
  const g = grid[sector] ?? grid.default ?? DEFAULT_GRID.default!;
  const optionsTotal = options.reduce((s, o) => s + (OPTIONS[o]?.price ?? 0), 0);
  const multiplier = 0.85 + 0.4 * (Math.max(0, Math.min(100, payScore)) / 100);
  const oneOff = round10((pages * g.perPage + optionsTotal) * multiplier);
  const monthly = Math.max(25, Math.min(45, round5(g.monthly * (0.9 + 0.2 * (payScore / 100)))));
  return {
    oneOff: { price: oneOff },
    hybrid: { setup: round10(oneOff * 0.6), monthly },
    subscription: { monthly: round5(oneOff / 24 + monthly), commitmentMonths: 12 },
  };
}

/** Rapproche la grille d'un secteur du prix réellement accepté (moyenne glissante, poids 0,3). */
export function adjustGrid(grid: Grid, sector: string, pages: number, acceptedOneOff: number): Grid {
  const cur = grid[sector] ?? grid.default ?? DEFAULT_GRID.default!;
  const observed = acceptedOneOff / Math.max(1, pages);
  return { ...grid, [sector]: { ...cur, perPage: cur.perPage * 0.7 + observed * 0.3 } };
}
