import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  agentRules: false,
  sassOptions: {
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  },
  async rewrites () {
    return [
      { source: '/partisymbol/:filnamn/:bild', destination: '/api/partisymbol/:filnamn/:bild' },
      { source: '/sitemap.xml', destination: '/api/sitemap' },
    ];
  },
};

export default nextConfig;
