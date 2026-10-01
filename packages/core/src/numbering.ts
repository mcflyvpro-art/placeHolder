export type DocKind = 'D' | 'F' | 'A';

/** D = devis, F = facture, A = avoir. Séquence sur 3 chiffres minimum, sans trou (garantie côté SQL). */
export function formatNumber(kind: DocKind, year: number, n: number): string {
  return `${kind}-${year}-${String(n).padStart(3, '0')}`;
}
