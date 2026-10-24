import { ETAPAS_FINAIS, type Etapa } from '@nobre/domain';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../lib/prisma';

const vendedorRef = { select: { id: true, nome: true } } as const;

/** Tudo o que a listagem precisa numa única query (sinais são calculados em memória: sem N+1). */
export const includeResumo = {
  itens: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  vendedor: vendedorRef,
  followUps: { where: { status: 'ABERTO' }, orderBy: { criadoEm: 'desc' }, take: 1 },
} as const satisfies Prisma.OportunidadeInclude;

export const includeDetalhe = {
  itens: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  vendedor: vendedorRef,
  transicoes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { vendedor: vendedorRef } },
  followUps: { orderBy: { criadoEm: 'desc' } },
} as const satisfies Prisma.OportunidadeInclude;

export type OportunidadeComResumo = Prisma.OportunidadeGetPayload<{ include: typeof includeResumo }>;
export type OportunidadeComDetalhe = Prisma.OportunidadeGetPayload<{ include: typeof includeDetalhe }>;

export interface FiltrosBanco {
  q?: string | null;
  etapas?: Etapa[];
  vendedorId?: string;
  incluirFinais: boolean;
}

const CODIGO = /^OPP-\d+$/i;

/** Aceita uuid ou código legível (OPP-2001). */
export function ondeIdOuCodigo(idOuCodigo: string): Prisma.OportunidadeWhereUniqueInput {
  return CODIGO.test(idOuCodigo) ? { codigo: idOuCodigo.toUpperCase() } : { id: idOuCodigo };
}

type Cliente = PrismaClient | Prisma.TransactionClient;

export const oportunidadesRepository = {
  listar(prisma: Cliente, f: FiltrosBanco) {
    const and: Prisma.OportunidadeWhereInput[] = [];
    if (f.q) {
      // Parametrizado pelo Prisma (ILIKE). Sem `unaccent`: "clinica" não encontra "Clínica" (limitação declarada).
      const contem = { contains: f.q, mode: 'insensitive' } as const;
      and.push({ OR: [{ codigo: contem }, { empresa: contem }, { itens: { some: { descricao: contem } } }] });
    }
    if (f.etapas?.length) and.push({ etapa: { in: f.etapas } });
    if (f.vendedorId) and.push({ vendedorId: f.vendedorId });
    if (!f.incluirFinais) and.push({ etapa: { notIn: [...ETAPAS_FINAIS] } });
    return prisma.oportunidade.findMany({ where: { AND: and }, include: includeResumo });
  },

  buscarResumo(prisma: Cliente, idOuCodigo: string) {
    return prisma.oportunidade.findUnique({ where: ondeIdOuCodigo(idOuCodigo), include: includeResumo });
  },

  buscarDetalhe(prisma: Cliente, idOuCodigo: string) {
    return prisma.oportunidade.findUnique({ where: ondeIdOuCodigo(idOuCodigo), include: includeDetalhe });
  },

  /** Maior número de código existente (OPP-2007 → 2007), ou null se não houver nenhum. */
  async maiorNumeroDeCodigo(prisma: Cliente): Promise<number | null> {
    const linhas = await prisma.$queryRaw<Array<{ maior: number | null }>>`
      SELECT MAX(CAST(SUBSTRING(codigo FROM 5) AS INTEGER)) AS maior
      FROM oportunidades WHERE codigo ~ '^OPP-[0-9]+$'`;
    const maior = linhas[0]?.maior;
    return maior === null || maior === undefined ? null : Number(maior);
  },
};
