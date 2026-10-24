import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import pkg from '../package.json' with { type: 'json' };
import type { Env } from './config/env';
import { criarRelogio, type Relogio } from './lib/clock';
import type { PrismaClient } from './lib/prisma';
import { rotasEtapas } from './modules/etapas/etapas.routes';
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
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
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
    allowedHeaders: ['content-type', 'x-vendedor-id', 'x-request-id'],
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

  // Gatilho pós-alteração: recalcular o follow-up da oportunidade (ligado junto com o motor de follow-up).
  const aoAlterar: AoAlterarOportunidade = async () => {};

  const oportunidades = new OportunidadesService(prisma, relogio, aoAlterar);
  const transicoes = new TransicoesService(prisma, relogio, aoAlterar);
  app.decorate('servicos', { relogio, oportunidades, transicoes });

  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        response: {
          200: z.object({ status: z.literal('ok'), hoje: z.string(), referenciaFixa: z.boolean(), versao: z.string() }),
        },
      },
    },
    () => ({ status: 'ok' as const, hoje: relogio.hoje(), referenciaFixa: relogio.referenciaFixa, versao: pkg.version }),
  );

  await app.register(rotasEtapas, { relogio });
  await app.register(rotasVendedores, { prisma });
  await app.register(rotasOportunidades, { identidade, oportunidades, transicoes });

  if (env.NODE_ENV === 'test') {
    // Só em teste: prova que erro inesperado vira 500 genérico, sem stack.
    app.get('/__teste/erro', async () => {
      throw new Error('falha simulada com detalhe interno');
    });
  }

  return app;
}
