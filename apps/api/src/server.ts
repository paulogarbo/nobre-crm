import { buildApp } from './app';
import { carregarEnv } from './config/env';
import { criarPrismaClient } from './lib/prisma';

const env = carregarEnv();
const prisma = criarPrismaClient(env.DATABASE_URL);
const app = await buildApp({ env, prisma });

async function encerrar(sinal: string) {
  app.log.info({ sinal }, 'encerrando');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));

await app.listen({ port: env.PORT, host: env.HOST });
app.log.info(
  { hoje: app.servicos.relogio.hoje(), referenciaFixa: app.servicos.relogio.referenciaFixa },
  'API pronta',
);
