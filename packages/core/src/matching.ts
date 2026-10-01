const STOP = new Set([
  'sarl', 'sas', 'sasu', 'eurl', 'sa', 'sci', 'snc', 'ei', 'eirl', 'et', 'le', 'la', 'les', 'de', 'des',
  'du', 'l', 'd', 'chez', 'fils', 'cie', 'compagnie', 'societe', 'ets', 'etablissements', 'entreprise',
]);

function tokens(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Similarité de Dice sur les tokens significatifs (0..1). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type PlaceRef = { name: string; postalCode: string | null; lat: number; lng: number };
export type SirenCandidate = { siren: string; names: string[]; postalCode: string | null; lat: number | null; lng: number | null };

export function pickSirenMatch(place: PlaceRef, candidates: SirenCandidate[]): { siren: string; confidence: number } | null {
  let best: { siren: string; confidence: number } | null = null;
  for (const c of candidates) {
    const sim = Math.max(0, ...c.names.map((n) => nameSimilarity(place.name, n)));
    const near =
      c.lat !== null && c.lng !== null && haversineMeters(place.lat, place.lng, c.lat, c.lng) < 300;
    const sameCp = place.postalCode !== null && c.postalCode === place.postalCode;
    const confidence = sim * 0.7 + (near ? 0.3 : sameCp ? 0.2 : 0);
    if (sim >= 0.5 && (near || sameCp) && (!best || confidence > best.confidence)) {
      best = { siren: c.siren, confidence: Math.round(confidence * 100) / 100 };
    }
  }
  return best;
}
