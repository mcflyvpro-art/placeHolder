import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ph/core'],
  // Navigation instantanée : les pages déjà visitées restent en cache client 30 s (les mutations revalident).
  experimental: { staleTimes: { dynamic: 30, static: 300 } },
  serverExternalPackages: ['@react-pdf/renderer', 'libsodium-wrappers', 'nodemailer'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      { source: '/(voir|signer)/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
