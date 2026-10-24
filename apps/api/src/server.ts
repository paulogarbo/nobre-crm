import { buildApp } from './app';
import { carregarEnv } from './config/env';
import { criarPrismaClient } from './lib/prisma';
import { iniciarJobFollowUps } from './modules/follow-ups/follow-ups.job';

const env = carregarEnv();
const prisma = criarPrismaClient(env.DATABASE_URL);
const app = await buildApp({ env, prisma });

let job: ReturnType<typeof iniciarJobFollowUps> | undefined;

async function encerrar(sinal: string) {
  app.log.info({ sinal }, 'encerrando');
  job?.parar();
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

// Job de follow-up: fora do buildApp para não rodar nos testes de integração.
if (env.NODE_ENV !== 'test') {
  job = iniciarJobFollowUps({
    servico: app.servicos.followUps,
    log: app.log,
    expressao: env.FOLLOWUP_CRON,
    webhookUrl: env.FOLLOWUP_WEBHOOK_URL,
  });
}
