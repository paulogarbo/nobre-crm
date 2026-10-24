import { respostaVendedores } from '@nobre/contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { PrismaClient } from '../../lib/prisma';
import { vendedoresRepository } from './vendedores.repository';

export async function rotasVendedores(app: FastifyInstance, { prisma }: { prisma: PrismaClient }) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/vendedores', { schema: { response: { 200: respostaVendedores } } }, () =>
      vendedoresRepository.listar(prisma),
    );
}
