import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const prod = process.env.SITE_MODE === 'production';
  const body = prod ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', site)}\n` : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
