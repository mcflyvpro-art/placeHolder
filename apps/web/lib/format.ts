const TRANCHES: Record<string, string> = {
  NN: 'Sans salarié', '00': 'Sans salarié', '01': '1-2 salariés', '02': '3-5 salariés', '03': '6-9 salariés',
  '11': '10-19 salariés', '12': '20-49 salariés', '21': '50-99 salariés', '22': '100-199 salariés',
};

export const trancheLabel = (t: string | null) => (t ? TRANCHES[t] ?? '50+ salariés' : null);

export const euro = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

export const dateFr = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  d ? new Intl.DateTimeFormat('fr-FR', opts).format(new Date(d)) : '—';

export const relative = (d: string | Date) => {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
};

export const yearOf = (d: string | null) => (d ? `depuis ${new Date(d).getFullYear()}` : null);

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
