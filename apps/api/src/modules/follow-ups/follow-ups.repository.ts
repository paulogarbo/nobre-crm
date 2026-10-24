import { ETAPAS_FINAIS, type DataCivil, type ProximaAcao } from '@nobre/domain';
import type { Prisma } from '../../generated/prisma/client';
import { paraDataBanco } from '../../lib/datas-banco';
import type { PrismaClient } from '../../lib/prisma';
import type { StatusFollowUp } from '@nobre/contracts';

type Cliente = PrismaClient | Prisma.TransactionClient;

export const includeOportunidade = {
  oportunidade: { include: { vendedor: { select: { id: true, nome: true } } } },
} as const satisfies Prisma.FollowUpInclude;
export type FollowUpComOportunidade = Prisma.FollowUpGetPayload<{ include: typeof includeOportunidade }>;

/** Status em que o registro sai de ABERTO por decisão do motor (não do vendedor). */
type EncerradoPeloMotor = Extract<StatusFollowUp, 'RESOLVIDO' | 'SUBSTITUIDO'>;

/** Acesso a `follow_ups` (e à leitura de oportunidade que o motor precisa). Sem regra de negócio. */
export const followUpsRepository = {
  /** Oportunidade com tudo o que o motor precisa: itens, nome do vendedor e a ação aberta (se houver). */
  buscarParaRecalculo(tx: Cliente, oportunidadeId: string) {
    return tx.oportunidade.findUnique({
      where: { id: oportunidadeId },
      include: { itens: true, vendedor: { select: { nome: true } }, followUps: { where: { status: 'ABERTO' } } },
    });
  },

  encerrar(tx: Cliente, id: string, status: EncerradoPeloMotor, agora: Date) {
    return tx.followUp.update({ where: { id }, data: { status, encerradoEm: agora } });
  },

  atualizarTextos(tx: Cliente, id: string, acao: Pick<ProximaAcao, 'prioridade' | 'titulo' | 'descricao'>) {
    return tx.followUp.update({
      where: { id },
      data: { prioridade: acao.prioridade, titulo: acao.titulo, descricao: acao.descricao },
    });
  },

  criarAberto(tx: Cliente, oportunidadeId: string, acao: ProximaAcao, hoje: DataCivil, agora: Date) {
    return tx.followUp.create({
      data: {
        oportunidadeId,
        tipo: acao.tipo,
        prioridade: acao.prioridade,
        titulo: acao.titulo,
        descricao: acao.descricao,
        venceEm: paraDataBanco(hoje),
        status: 'ABERTO',
        criadoEm: agora,
      },
    });
  },

  /** Alvos do recálculo geral: todas as não finais + finais que ainda tenham ação aberta. */
  async idsParaRecalculo(prisma: Cliente): Promise<string[]> {
    const alvos = await prisma.oportunidade.findMany({
      where: { OR: [{ etapa: { notIn: [...ETAPAS_FINAIS] } }, { followUps: { some: { status: 'ABERTO' } } }] },
      select: { id: true },
      orderBy: { codigo: 'asc' },
    });
    return alvos.map((a) => a.id);
  },

  listarDoVendedor(prisma: Cliente, vendedorId: string, status: StatusFollowUp, ate?: DataCivil) {
    return prisma.followUp.findMany({
      where: {
        status,
        oportunidade: { vendedorId },
        ...(ate ? { venceEm: { lte: paraDataBanco(ate) } } : {}),
      },
      include: includeOportunidade,
    });
  },

  buscar(tx: Cliente, id: string) {
    return tx.followUp.findUnique({ where: { id } });
  },

  buscarComOportunidade(prisma: Cliente, id: string) {
    return prisma.followUp.findUniqueOrThrow({ where: { id }, include: includeOportunidade });
  },

  /** Encerramento condicional: só conclui se ainda estiver ABERTO. Devolve quantos registros mudaram (0 ou 1). */
  async concluirSeAberto(tx: Cliente, id: string, agora: Date): Promise<number> {
    const { count } = await tx.followUp.updateMany({
      where: { id, status: 'ABERTO' },
      data: { status: 'CONCLUIDO', encerradoEm: agora },
    });
    return count;
  },
};
