import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // O domínio é TypeScript puro do workspace: o Next transpila junto com o app.
  transpilePackages: ['@nobre/domain'],
  // Build enxuto para o Docker (server.js + só as dependências usadas). Só no Dockerfile: no Windows,
  // o standalone precisa criar symlinks, o que exige modo desenvolvedor/admin.
  ...(process.env.NEXT_STANDALONE === '1'
    ? { output: 'standalone' as const, outputFileTracingRoot: path.join(import.meta.dirname, '../../') }
    : {}),
  // O lint roda separado (`pnpm lint`), com a configuração flat do monorepo.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default config;
