import { ETAPAS_FINAIS, Etapa } from '@nobre/domain';
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

/** Escapa os curingas do LIKE (`%`, `_`) e o próprio escape (`\`), para buscar o texto literal. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Aceita uuid ou código legível (OPP-2001). */
export function ondeIdOuCodigo(idOuCodigo: string): Prisma.OportunidadeWhereUniqueInput {
  return CODIGO.test(idOuCodigo) ? { codigo: idOuCodigo.toUpperCase() } : { id: idOuCodigo };
}

type Cliente = PrismaClient | Prisma.TransactionClient;

export interface NovoItem {
  descricao: string;
  quantidade: number;
  valorUnitario?: number | null;
}

function dadosItens(oportunidadeId: string, itens: NovoItem[], base: Date) {
  // createdAt crescente preserva a ordem informada pelo vendedor.
  return itens.map((item, i) => ({
    oportunidadeId,
    descricao: item.descricao,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario ?? null,
    createdAt: new Date(base.getTime() + i),
  }));
}

export const oportunidadesRepository = {
  listar(prisma: Cliente, f: FiltrosBanco) {
    const and: Prisma.OportunidadeWhereInput[] = [];
    if (f.q) {
      // Parametrizado pelo Prisma (ILIKE). O Prisma não escapa os curingas do LIKE: "%" e "_" digitados
      // pelo vendedor são literais. Sem `unaccent`: "clinica" não encontra "Clínica" (limitação declarada).
      const contem = { contains: escaparLike(f.q), mode: 'insensitive' } as const;
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

  /** Cria a oportunidade em Primeiro Contato com os itens e a linha "criada" do histórico. Rodar em transação. */
  async inserir(
    tx: Prisma.TransactionClient,
    dados: Omit<Prisma.OportunidadeUncheckedCreateInput, 'etapa' | 'createdAt'>,
    itens: NovoItem[],
    executorId: string,
    agora: Date,
  ) {
    const op = await tx.oportunidade.create({ data: { ...dados, etapa: Etapa.PRIMEIRO_CONTATO, createdAt: agora } });
    if (itens.length) await tx.itemBrinde.createMany({ data: dadosItens(op.id, itens, agora) });
    await tx.transicaoEtapa.create({
      data: { oportunidadeId: op.id, deEtapa: null, paraEtapa: Etapa.PRIMEIRO_CONTATO, vendedorId: executorId, createdAt: agora },
    });
    return op;
  },

  buscarEtapa(prisma: Cliente, idOuCodigo: string) {
    return prisma.oportunidade.findUnique({ where: ondeIdOuCodigo(idOuCodigo), select: { id: true, etapa: true } });
  },

  /** Atualiza os campos e, se `itens` vier, substitui a lista inteira. Rodar em transação. */
  async atualizar(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.OportunidadeUncheckedUpdateInput,
    itens: NovoItem[] | undefined,
    agora: Date,
  ) {
    await tx.oportunidade.update({ where: { id }, data });
    if (itens !== undefined) {
      await tx.itemBrinde.deleteMany({ where: { oportunidadeId: id } });
      if (itens.length) await tx.itemBrinde.createMany({ data: dadosItens(id, itens, agora) });
    }
  },

  buscarParaContato(prisma: Cliente, idOuCodigo: string) {
    return prisma.oportunidade.findUnique({
      where: ondeIdOuCodigo(idOuCodigo),
      select: { id: true, etapa: true, ultimoContato: true, observacoes: true },
    });
  },

  gravarContato(prisma: Cliente, id: string, ultimoContato: Date, observacoes: string | null) {
    return prisma.oportunidade.update({ where: { id }, data: { ultimoContato, observacoes } });
  },

  buscarObservacoes(prisma: Cliente, id: string) {
    return prisma.oportunidade.findUnique({ where: { id }, select: { observacoes: true } });
  },

  gravarObservacoes(prisma: Cliente, id: string, observacoes: string) {
    return prisma.oportunidade.update({ where: { id }, data: { observacoes } });
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
