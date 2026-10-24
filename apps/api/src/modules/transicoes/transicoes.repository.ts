import { Etapa } from '@nobre/domain';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../lib/prisma';
import { ondeIdOuCodigo } from '../oportunidades/oportunidades.repository';

type Cliente = PrismaClient | Prisma.TransactionClient;

export interface MudancaDeEtapa {
  oportunidadeId: string;
  /** Etapa e updatedAt lidos na validação: a escrita só acontece se ainda forem esses. */
  de: Etapa;
  lidaEm: Date;
  para: Etapa;
  motivo: string | null;
  executorId: string;
}

/** Acesso a `transicoes_etapa` e à mudança de etapa da oportunidade. Sem regra de negócio. */
export const transicoesRepository = {
  buscarOportunidade(prisma: Cliente, idOuCodigo: string) {
    return prisma.oportunidade.findUnique({ where: ondeIdOuCodigo(idOuCodigo), include: { itens: true } });
  },

  /**
   * Concorrência otimista: muda a etapa só se a oportunidade não mudou desde a leitura e, nesse caso,
   * grava a linha do histórico. Devolve false se outra requisição chegou antes (nada é gravado).
   * Precisa rodar dentro de uma transação para etapa e histórico serem atômicos.
   */
  async aplicar(tx: Prisma.TransactionClient, m: MudancaDeEtapa): Promise<boolean> {
    const { count } = await tx.oportunidade.updateMany({
      where: { id: m.oportunidadeId, etapa: m.de, updatedAt: m.lidaEm },
      data: { etapa: m.para, ...(m.para === Etapa.PERDIDA ? { motivoPerda: m.motivo } : {}) },
    });
    if (count === 0) return false;
    await tx.transicaoEtapa.create({
      data: { oportunidadeId: m.oportunidadeId, deEtapa: m.de, paraEtapa: m.para, motivo: m.motivo, vendedorId: m.executorId },
    });
    return true;
  },
};
