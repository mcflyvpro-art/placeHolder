import { createServer } from 'node:http';
import handler from 'serve-handler';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';

export async function browserChecks({ production, pages }) {
  const server = createServer((req, res) => handler(req, res, { public: 'dist', cleanUrls: true }));
  await new Promise((r) => server.listen(4319, r));
  const base = 'http://localhost:4319';
  const browser = await chromium.launch({ args: ['--remote-debugging-port=9223'] });
  const axe = [];
  try {
    const ctx = await browser.newContext();
    for (const path of pages) {
      const page = await ctx.newPage();
      await page.goto(base + path, { waitUntil: 'networkidle' });
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))) {
        axe.push(`${path}: ${v.id} (${v.nodes.length})`);
      }
      await page.close();
    }
    const lh = await lighthouse(`${base}/`, {
      port: 9223,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      // En aperçu le site est volontairement en noindex : on ignore ce seul audit.
      skipAudits: production ? [] : ['is-crawlable'],
    });
    const cats = lh.lhr.categories;
    const score = (k) => Math.round((cats[k]?.score ?? 0) * 100);
    const lighthouseScores = {
      performance: score('performance'),
      accessibility: score('accessibility'),
      bestPractices: score('best-practices'),
      seo: score('seo'),
    };
    const lhPassed = Object.values(lighthouseScores).every((v) => v >= 95);
    return { axe, lighthouse: lighthouseScores, passed: axe.length === 0 && lhPassed };
  } finally {
    await browser.close();
    server.close();
  }
}
