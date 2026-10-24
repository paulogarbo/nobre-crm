import type { FastifyInstance, InjectOptions } from 'fastify';
import { executarSeed } from '../prisma/seed-runner';
import { buildApp } from '../src/app';
import { carregarEnv } from '../src/config/env';
import { criarPrismaClient, type PrismaClient } from '../src/lib/prisma';

export interface Contexto {
  app: FastifyInstance;
  prisma: PrismaClient;
  fechar(): Promise<void>;
}

export async function criarContexto(): Promise<Contexto> {
  const env = carregarEnv(process.env);
  if (!env.DATABASE_URL.includes('_test')) throw new Error('Testes só rodam contra um banco _test');
  const prisma = criarPrismaClient(env.DATABASE_URL);
  const app = await buildApp({ env, prisma });
  await app.ready();
  return {
    app,
    prisma,
    async fechar() {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

export type Vendedores = Record<'Ana' | 'Bruno' | 'Carla', string>;

/** Zera o banco de teste e aplica o seed do case. Devolve os ids dos vendedores por nome. */
export async function resetarComSeed(prisma: PrismaClient): Promise<Vendedores> {
  await zerarBanco(prisma);
  await executarSeed(prisma);
  const lista = await prisma.vendedor.findMany();
  return Object.fromEntries(lista.map((v) => [v.nome, v.id])) as Vendedores;
}

export async function zerarBanco(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE follow_ups, transicoes_etapa, itens_brinde, oportunidades, vendedores RESTART IDENTITY CASCADE',
  );
}

interface OpcoesInject {
  body?: unknown;
  vendedorId?: string;
  headers?: Record<string, string>;
}

/** Atalho para `app.inject` com o header de identidade e o parse do JSON. */
export async function chamar<T = any>(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  { body, vendedorId, headers = {} }: OpcoesInject = {},
) {
  const opcoes: InjectOptions = { method, url, headers: { ...headers } };
  if (vendedorId) opcoes.headers = { ...opcoes.headers, 'x-vendedor-id': vendedorId };
  if (body !== undefined) opcoes.payload = body as InjectOptions['payload'];
  const res = await app.inject(opcoes);
  const json = res.body ? (JSON.parse(res.body) as T) : (undefined as T);
  return { status: res.statusCode, body: json, headers: res.headers };
}
