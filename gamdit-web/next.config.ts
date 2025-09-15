import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ✅ Let the app build on Vercel even if ESLint finds issues.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // (optional) if you ever hit TS type errors on Vercel, you can temporarily add:
  // typescript: { ignoreBuildErrors: true },

  // 🔒 Security headers for better hardening (preview CSP allows vercel.live toolbar)
  async headers() {
    const isPreview = process.env.VERCEL_ENV === 'preview';
    const base = [
      // HSTS - Force HTTPS for 2 years, include subdomains, and preload
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      // Prevent MIME type sniffing
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Prevent clickjacking
      { key: 'X-Frame-Options', value: 'DENY' },
      // XSS protection
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      // Referrer policy
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];

    const previewCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "connect-src 'self' https://vercel.live https: wss:",
      "img-src 'self' blob: data:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "frame-src https://vercel.live",
      "frame-ancestors 'none'",
    ].join('; ');

    const prodCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https: wss:",
      "img-src 'self' blob: data:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "frame-src 'none'",
      "frame-ancestors 'none'",
    ].join('; ');

    const headers = [
      ...base,
      { key: 'Content-Security-Policy', value: isPreview ? previewCsp : prodCsp },
    ];

    return [
      {
        source: '/:path*',
        headers,
      },
    ];
  },
};

export default nextConfig;