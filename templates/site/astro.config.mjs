import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import brief from './brief.json' with { type: 'json' };

const mode = process.env.SITE_MODE ?? 'preview';
const site = mode === 'production' && brief.domain ? `https://${brief.domain}` : (brief.previewUrl ?? 'https://example.com');

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  compressHTML: true,
  integrations: mode === 'production' ? [sitemap()] : [],
});
