import { validarTransicao, type Etapa } from '@nobre/domain';
import type { Relogio } from '../../lib/clock';
import { erroDeDominio, erros } from '../../lib/errors';
import type { PrismaClient } from '../../lib/prisma';
import { paraDominio } from '../oportunidades/oportunidades.mapper';
import type { AoAlterarOportunidade, Executor } from '../oportunidades/oportunidades.service';
import { transicoesRepository as repo } from './transicoes.repository';

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
    const op = await repo.buscarOportunidade(this.prisma, idOuCodigo);
    if (!op) throw erros.oportunidadeNaoEncontrada();

    const de = op.etapa;
    const resultado = validarTransicao(paraDominio(op), para, motivo, this.relogio.hoje());
    if (!resultado.ok) throw erroDeDominio(resultado);

    const motivoLimpo = motivo?.trim() || null;
    // Concorrência otimista: só grava se a oportunidade não mudou desde a validação (etapa e
    // updatedAt). Um PATCH no meio (ex.: apagou a validade) força revalidar contra o estado novo.
    const aplicou = await this.prisma.$transaction((tx) =>
      repo.aplicar(tx, {
        oportunidadeId: op.id,
        de,
        lidaEm: op.updatedAt,
        para,
        motivo: motivoLimpo,
        executorId: executor.id,
      }),
    );

    if (!aplicou) {
      // Outra requisição mudou a oportunidade entre a leitura e a escrita: revalida contra o estado novo.
      if (tentativa >= 1) throw erros.oportunidadeAlterada();
      return this.transicionar(idOuCodigo, para, motivo, executor, tentativa + 1);
    }

    await this.aoAlterar(op.id);
    return op.id;
  }
}
