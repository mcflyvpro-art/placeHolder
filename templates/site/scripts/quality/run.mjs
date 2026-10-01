// Contrôle qualité complet. Échec = pas de mise en ligne.
import { writeFileSync } from 'node:fs';
import { staticChecks } from './static.mjs';

const production = process.env.SITE_MODE === 'production';
const staticOnly = process.argv.includes('--static');

const s = staticChecks({ production });
let b = null;
if (!staticOnly) {
  const { browserChecks } = await import('./browser.mjs');
  const pages = ['/', '/mentions-legales', '/confidentialite'];
  b = await browserChecks({ production, pages });
}

const report = {
  mode: production ? 'production' : 'preview',
  pages: s.pages,
  todo: s.issues.todo.length,
  slop: s.issues.slop,
  legal: s.issues.legal,
  links: s.issues.links,
  axe: b?.axe ?? null,
  lighthouse: b?.lighthouse ?? null,
  passed: s.passed && (b ? b.passed : true),
};
writeFileSync('quality.json', JSON.stringify(report, null, 2));

const line = (ok, label, detail = '') => console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
line(s.issues.slop.length === 0, 'Anti-slop', s.issues.slop.join(' | '));
line(s.issues.legal.length === 0, 'Légal', s.issues.legal.join(' | '));
line(s.issues.links.length === 0, 'Liens', s.issues.links.join(' | '));
line(!production || s.issues.todo.length === 0, `[À COMPLÉTER] restants : ${s.issues.todo.length}`, s.issues.todo.slice(0, 8).join(' | '));
if (b) {
  line(b.axe.length === 0, 'Accessibilité (axe)', b.axe.join(' | '));
  line(Object.values(b.lighthouse).every((v) => v >= 95), 'Lighthouse', JSON.stringify(b.lighthouse));
}
console.log(report.passed ? '\nQualité OK' : '\nQualité insuffisante');
process.exit(report.passed ? 0 : 1);
