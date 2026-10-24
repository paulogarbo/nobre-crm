import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { PrismaClient } from '../../lib/prisma';
import { vendedoresRepository } from './vendedores.repository';

const respostaVendedores = z.array(z.object({ id: z.string(), nome: z.string(), email: z.string() }));

export async function rotasVendedores(app: FastifyInstance, { prisma }: { prisma: PrismaClient }) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/vendedores', { schema: { response: { 200: respostaVendedores } } }, () =>
      vendedoresRepository.listar(prisma),
    );
}
