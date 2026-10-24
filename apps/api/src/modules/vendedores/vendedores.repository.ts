import type { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../lib/prisma';

type Cliente = PrismaClient | Prisma.TransactionClient;

export const vendedoresRepository = {
  listar(prisma: Cliente) {
    return prisma.vendedor.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true, email: true } });
  },

  async existe(prisma: Cliente, id: string): Promise<boolean> {
    return (await prisma.vendedor.findUnique({ where: { id }, select: { id: true } })) !== null;
  },
};
