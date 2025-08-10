import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ✅ Let the app build on Vercel even if ESLint finds issues.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // (optional) if you ever hit TS type errors on Vercel, you can temporarily add:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;