import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    ignores: ['.next/**', '.release/**', 'out/**', 'design/**', 'next-env.d.ts'],
  },
];

export default config;
