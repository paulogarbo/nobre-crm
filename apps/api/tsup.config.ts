import { defineConfig } from 'tsup';

// Empacota o servidor e o seed em arquivos ESM únicos (dist/server.js e dist/seed.js). O domínio e o
// contrato (TypeScript puro do workspace) e o client gerado pelo Prisma entram no bundle; as dependências
// do node_modules ficam externas. Assim a imagem de produção não precisa de src/, tsx nem dos pacotes.
export default defineConfig({
  entry: { server: 'src/server.ts', seed: 'prisma/seed.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: ['@nobre/domain', '@nobre/contracts'],
});
