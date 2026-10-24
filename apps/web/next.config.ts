import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // O domínio é TypeScript puro do workspace: o Next transpila junto com o app.
  transpilePackages: ['@nobre/domain'],
  // Build enxuto para o Docker (server.js + só as dependências usadas).
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // O lint roda separado (`pnpm lint`), com a configuração flat do monorepo.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default config;
