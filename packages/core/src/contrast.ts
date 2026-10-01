function toRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Assombrit (ou éclaircit sur fond sombre) `fg` jusqu'à atteindre le ratio cible. */
export function ensureAA(fg: string, bg: string, target = 4.5): string {
  if (contrastRatio(fg, bg) >= target) return fg;
  const darken = luminance(bg) > 0.5;
  let rgb = toRgb(fg);
  for (let i = 0; i < 100; i++) {
    rgb = rgb.map((v) => (darken ? v * 0.95 : v + (255 - v) * 0.05)) as [number, number, number];
    const hex = toHex(rgb);
    if (contrastRatio(hex, bg) >= target) return hex;
  }
  return darken ? '#000000' : '#ffffff';
}
