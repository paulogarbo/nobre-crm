import { defineConfig } from 'tsup';

// Empacota o servidor num único arquivo ESM. O domínio (TypeScript puro do workspace) e o client
// gerado pelo Prisma entram no bundle; as dependências do node_modules ficam externas.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: ['@nobre/domain'],
});
