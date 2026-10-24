import { criarPrismaClient } from '../src/lib/prisma';
import { executarSeed } from './seed-runner';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definida');

const prisma = criarPrismaClient(url);
try {
  const r = await executarSeed(prisma);
  process.stdout.write(
    `Seed concluído: ${r.vendedores} vendedores, ${r.oportunidades} oportunidades, ${r.itens} itens, ${r.transicoes} transições.\n`,
  );
} finally {
  await prisma.$disconnect();
}
