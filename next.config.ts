import { readFileSync } from 'node:fs';

import type { NextConfig } from 'next';

/**
 * The released version, read from package.json at build time and inlined into
 * both bundles as `process.env.PARTIDATA_VERSION`. The deploy workflow refuses
 * to build a `v*` tag that names a different version, so what the artifact
 * reports is the tag it was built from.
 */
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

const nextConfig: NextConfig = {
  env: { PARTIDATA_VERSION: version },
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
      { source: '/data/:path+', destination: '/api/data/:path+' },
      { source: '/sitemap.xml', destination: '/api/sitemap' },
    ];
  },
};

export default nextConfig;
