// Captures pour la revue visuelle de Claude : 375 / 768 / 1440 px, pleine page.
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import handler from 'serve-handler';
import { chromium } from 'playwright';

const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['/'];
const widths = [375, 768, 1440];
mkdirSync('.shots', { recursive: true });
const server = createServer((req, res) => handler(req, res, { public: 'dist', cleanUrls: true }));
await new Promise((r) => server.listen(4320, r));
const browser = await chromium.launch();
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: w < 800 ? 2 : 1 });
  for (const p of pages) {
    await page.goto(`http://localhost:4320${p}`, { waitUntil: 'networkidle' });
    const name = `${(p === '/' ? 'home' : p.slice(1).replace(/\//g, '_'))}-${w}.png`;
    await page.screenshot({ path: `.shots/${name}`, fullPage: true });
    console.log(`.shots/${name}`);
  }
  await page.close();
}
await browser.close();
server.close();
