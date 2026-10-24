import { defineConfig } from 'vitest/config';

/** Ambiente dos testes: banco separado (`_test`) e data de referência fixa. */
const ENV_TESTE = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://nobre:nobre@localhost:5432/nobre_crm_test',
  REFERENCE_DATE: '2026-10-15',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  CORS_ORIGIN: 'http://localhost:3000',
  FOLLOWUP_WEBHOOK_URL: '',
};

// O globalSetup roda no processo principal: ele também precisa enxergar essas variáveis.
Object.assign(process.env, ENV_TESTE);

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Os testes de integração compartilham um banco real: arquivos rodam em sequência.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    env: ENV_TESTE,
  },
});
