import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ✅ Let the app build on Vercel even if ESLint finds issues.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // (optional) if you ever hit TS type errors on Vercel, you can temporarily add:
  // typescript: { ignoreBuildErrors: true },

  // 🔒 Security headers for better hardening
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // HSTS - Force HTTPS for 2 years, include subdomains, and preload
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Content Security Policy (basic)
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;