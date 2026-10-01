// En-têtes Cloudflare Pages : sécurité, cache, et noindex hors production.
import { writeFileSync } from 'node:fs';

const prod = process.env.SITE_MODE === 'production';
// L'aperçu doit pouvoir s'afficher dans placeHolder (Atelier, lien de présentation).
const app = process.env.PH_APP_ORIGIN ?? '';
const ancestors = prod ? "'self'" : `'self' ${app}`.trim();
const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Content-Security-Policy: frame-ancestors ${ancestors}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
${prod ? '' : '  X-Robots-Tag: noindex, nofollow\n'}
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
`;
writeFileSync('dist/_headers', headers);
console.log(`_headers écrit (${prod ? 'production' : 'preview'})`);
