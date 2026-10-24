import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { respostaHealth } from '@nobre/contracts';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import pkg from '../package.json' with { type: 'json' };
import type { Env } from './config/env';
import { criarRelogio, type Relogio } from './lib/clock';
import type { PrismaClient } from './lib/prisma';
import { rotasEtapas } from './modules/etapas/etapas.routes';
import { rotasFollowUps } from './modules/follow-ups/follow-ups.routes';
import { FollowUpsService } from './modules/follow-ups/follow-ups.service';
import { rotasOportunidades } from './modules/oportunidades/oportunidades.routes';
import { OportunidadesService, type AoAlterarOportunidade } from './modules/oportunidades/oportunidades.service';
import { TransicoesService } from './modules/transicoes/transicoes.service';
import { rotasVendedores } from './modules/vendedores/vendedores.routes';
import { registrarTratamentoDeErros } from './plugins/error-handler';
import { criarIdentidade } from './plugins/identidade';

// Mensagens de validação do zod em português.
z.config(z.locales.pt());

export interface OpcoesApp {
  env: Env;
  prisma: PrismaClient;
  relogio?: Relogio;
}

export interface Servicos {
  relogio: Relogio;
  oportunidades: OportunidadesService;
  transicoes: TransicoesService;
  followUps: FollowUpsService;
}

declare module 'fastify' {
  interface FastifyInstance {
    servicos: Servicos;
  }
}

/** Monta a aplicação sem abrir porta nem agendar jobs (usado pelo server e pelos testes). */
export async function buildApp({ env, prisma, relogio = criarRelogio(env.REFERENCE_DATE) }: OpcoesApp): Promise<FastifyInstance> {
  const app = Fastify({
    // O Fastify não loga corpo de requisição: dados de contato (e-mail, telefone) não vão para o log.
    logger: { level: env.LOG_LEVEL },
    // O id de correlação é sempre gerado aqui: aceitar o do cliente permitiria forjar ou colidir
    // ids nos logs. Ele volta na resposta (header x-request-id).
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    bodyLimit: 256 * 1024,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registrarTratamentoDeErros(app);
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-vendedor-id'],
    exposedHeaders: ['x-request-id'],
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req: FastifyRequest, ctx: { max: number }) => ({
      statusCode: 429,
      code: 'MUITAS_REQUISICOES',
      message: `Limite de ${ctx.max} requisições por minuto atingido.`,
    }),
  });

  const identidade = criarIdentidade(app, prisma);

  // Gatilho pós-alteração (após o commit): recalcular a próxima ação da oportunidade. Se o recálculo
  // falhar, a alteração já está gravada; o erro vai para o log e o job corrige na próxima execução.
  const aoAlterar: AoAlterarOportunidade = async (id) => {
    try {
      await followUps.recalcularPara(id);
    } catch (erro) {
      app.log.error({ err: erro, oportunidadeId: id }, 'falha ao recalcular follow-up');
    }
  };

  const oportunidades = new OportunidadesService(prisma, relogio, aoAlterar);
  const transicoes = new TransicoesService(prisma, relogio, aoAlterar);
  const followUps = new FollowUpsService(prisma, relogio, () => oportunidades, aoAlterar);
  app.decorate('servicos', { relogio, oportunidades, transicoes, followUps });

  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        response: {
          200: respostaHealth,
        },
      },
    },
    () => ({ status: 'ok' as const, hoje: relogio.hoje(), referenciaFixa: relogio.referenciaFixa, versao: pkg.version }),
  );

  await app.register(rotasEtapas, { relogio });
  await app.register(rotasVendedores, { prisma });
  await app.register(rotasOportunidades, { identidade, oportunidades, transicoes });
  await app.register(rotasFollowUps, { identidade, followUps });

  if (env.NODE_ENV === 'test') {
    // Só em teste: prova que erro inesperado vira 500 genérico, sem stack.
    app.get('/__teste/erro', async () => {
      throw new Error('falha simulada com detalhe interno');
    });
  }

  return app;
}
