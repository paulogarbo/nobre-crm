import { Etapa, validarTransicao } from '@nobre/domain';
import type { Relogio } from '../../lib/clock';
import { erroDeDominio, erros } from '../../lib/errors';
import type { PrismaClient } from '../../lib/prisma';
import { paraDominio } from '../oportunidades/oportunidades.mapper';
import { ondeIdOuCodigo } from '../oportunidades/oportunidades.repository';
import type { AoAlterarOportunidade, Executor } from '../oportunidades/oportunidades.service';

/**
 * Mudança de etapa. A regra vem inteira do domínio (`validarTransicao`); aqui só há orquestração:
 * carregar, validar, gravar etapa + histórico na mesma transação e, após o commit, recalcular o follow-up.
 */
export class TransicoesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly relogio: Relogio,
    private readonly aoAlterar: AoAlterarOportunidade,
  ) {}

  /** Retorna o id da oportunidade transicionada. Falha de regra → 422 com o código do domínio. */
  async transicionar(
    idOuCodigo: string,
    para: Etapa,
    motivo: string | null | undefined,
    executor: Executor,
    tentativa = 0,
  ): Promise<string> {
    const op = await this.prisma.oportunidade.findUnique({
      where: ondeIdOuCodigo(idOuCodigo),
      include: { itens: true },
    });
    if (!op) throw erros.oportunidadeNaoEncontrada();

    const de = op.etapa as Etapa;
    const resultado = validarTransicao(paraDominio(op), para, motivo, this.relogio.hoje());
    if (!resultado.ok) throw erroDeDominio(resultado);

    const motivoLimpo = motivo?.trim() || null;
    const aplicou = await this.prisma.$transaction(async (tx) => {
      // Concorrência otimista: só grava se a etapa ainda é a que foi validada.
      const { count } = await tx.oportunidade.updateMany({
        where: { id: op.id, etapa: de },
        data: { etapa: para, ...(para === Etapa.PERDIDA ? { motivoPerda: motivoLimpo } : {}) },
      });
      if (count === 0) return false;
      await tx.transicaoEtapa.create({
        data: { oportunidadeId: op.id, deEtapa: de, paraEtapa: para, motivo: motivoLimpo, vendedorId: executor.id },
      });
      return true;
    });

    if (!aplicou) {
      // Outra requisição mudou a etapa entre a leitura e a escrita: revalida contra o estado novo.
      if (tentativa >= 1) throw erros.oportunidadeAlterada();
      return this.transicionar(idOuCodigo, para, motivo, executor, tentativa + 1);
    }

    await this.aoAlterar(op.id);
    return op.id;
  }
}
