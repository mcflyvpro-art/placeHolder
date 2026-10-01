import raw from '../../brief.json';

export type Brief = typeof raw;
export const brief: Brief = raw;

export const isProduction = (import.meta.env.SITE_MODE ?? process.env.SITE_MODE) === 'production';

/** Téléphone au format lien `tel:`. */
export const tel = (p: string | null | undefined) => (p ? `tel:${p.replace(/[^\d+]/g, '')}` : undefined);
