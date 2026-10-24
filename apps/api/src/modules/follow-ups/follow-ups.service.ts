import type { FollowUpDTO, StatusFollowUp } from '@nobre/contracts';
import { ROTULOS, diasEntre, pesoPrioridade, proximaAcao, type DataCivil, type Prioridade } from '@nobre/domain';
import { Prisma, type FollowUp } from '../../generated/prisma/client';
import type { Relogio } from '../../lib/clock';
import { deDataBanco } from '../../lib/datas-banco';
import { erros } from '../../lib/errors';
import type { PrismaClient } from '../../lib/prisma';
import { followUpDaOportunidadeDTO, paraDominio } from '../oportunidades/oportunidades.mapper';
import type { AoAlterarOportunidade, Executor, OportunidadesService } from '../oportunidades/oportunidades.service';
import { vendedoresRepository } from '../vendedores/vendedores.repository';
import { followUpsRepository as repo, type FollowUpComOportunidade } from './follow-ups.repository';

export interface ResultadoRecalculo {
  criados: number;
  resolvidos: number;
  substituidos: number;
  mantidos: number;
}

/** Ação nova (criada ou que substituiu outra), para a notificação do job. */
export interface AcaoNova {
  codigo: string;
  empresa: string;
  vendedor: string;
  prioridade: Prioridade;
  titulo: string;
}

const zero = (): ResultadoRecalculo => ({ criados: 0, resolvidos: 0, substituidos: 0, mantidos: 0 });

function somar(a: ResultadoRecalculo, b: ResultadoRecalculo): ResultadoRecalculo {
  return {
    criados: a.criados + b.criados,
    resolvidos: a.resolvidos + b.resolvidos,
    substituidos: a.substituidos + b.substituidos,
    mantidos: a.mantidos + b.mantidos,
  };
}

/**
 * Motor de follow-up: para cada oportunidade não final, materializa UMA "próxima ação" (a mais
 * urgente, decidida por `proximaAcao` do domínio) como um FollowUp ABERTO. Idempotente: rodar de
 * novo sem mudança nos dados não cria, não substitui e não resolve nada.
 */
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly relogio: Relogio,
    /** Resolvido depois da construção (dependência mútua com OportunidadesService). */
    private readonly oportunidades: () => OportunidadesService,
    /** Gatilho pós-commit (recálculo com log de falha); por padrão, recalcula direto. */
    private readonly aoAlterar: AoAlterarOportunidade = async (id) => {
      await this.recalcularPara(id);
    },
  ) {}

  toDTO(f: FollowUpComOportunidade, hoje: DataCivil): FollowUpDTO {
    const etapa = f.oportunidade.etapa;
    const venceEm = deDataBanco(f.venceEm);
    return {
      ...followUpDaOportunidadeDTO(f),
      oportunidade: {
        id: f.oportunidade.id,
        codigo: f.oportunidade.codigo,
        empresa: f.oportunidade.empresa,
        etapa,
        etapaRotulo: ROTULOS[etapa],
        valorEstimado: f.oportunidade.valorEstimado === null ? null : Number(f.oportunidade.valorEstimado),
        vendedor: f.oportunidade.vendedor,
      },
      atrasado: f.status === 'ABERTO' && diasEntre(venceEm, hoje) > 0,
    };
  }

  /** Recalcula a ação de uma oportunidade (transação própria). */
  async recalcularPara(oportunidadeId: string, novas: AcaoNova[] = []): Promise<ResultadoRecalculo> {
    try {
      return await this.recalcularUma(oportunidadeId, novas);
    } catch (erro) {
      // Corrida com outra execução (job × requisição) esbarrou no índice único parcial: refaz uma vez.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        return this.recalcularUma(oportunidadeId, novas);
      }
      throw erro;
    }
  }

  private async recalcularUma(oportunidadeId: string, novas: AcaoNova[]): Promise<ResultadoRecalculo> {
    const hoje = this.relogio.hoje();
    const agora = this.relogio.agora();
    return this.prisma.$transaction(async (tx) => {
      const op = await repo.buscarParaRecalculo(tx, oportunidadeId);
      const r = zero();
      if (!op) return r;

      const aberto: FollowUp | undefined = op.followUps[0];
      const acao = proximaAcao(paraDominio(op), hoje); // finais → null

      if (!acao) {
        if (aberto) {
          await repo.encerrar(tx, aberto.id, 'RESOLVIDO', agora);
          r.resolvidos++;
        }
        return r;
      }

      if (aberto && aberto.tipo === acao.tipo) {
        // Mesmo motivo: atualiza textos/prioridade e mantém o vencimento original (preserva o "atrasado").
        if (aberto.prioridade !== acao.prioridade || aberto.titulo !== acao.titulo || aberto.descricao !== acao.descricao) {
          await repo.atualizarTextos(tx, aberto.id, acao);
        }
        r.mantidos++;
        return r;
      }

      if (aberto) {
        await repo.encerrar(tx, aberto.id, 'SUBSTITUIDO', agora);
        r.substituidos++;
      } else {
        r.criados++;
      }
      await repo.criarAberto(tx, op.id, acao, hoje, agora);
      novas.push({
        codigo: op.codigo,
        empresa: op.empresa,
        vendedor: op.vendedor.nome,
        prioridade: acao.prioridade,
        titulo: acao.titulo,
      });
      return r;
    });
  }

  /** Mesma função do job: todas as não finais + finais que ainda tenham ação aberta (para resolvê-las). */
  async recalcularTodos(): Promise<ResultadoRecalculo & { hoje: DataCivil; novas: AcaoNova[] }> {
    const alvos = await repo.idsParaRecalculo(this.prisma);
    const novas: AcaoNova[] = [];
    let total = zero();
    for (const id of alvos) total = somar(total, await this.recalcularPara(id, novas));
    return { hoje: this.relogio.hoje(), ...total, novas };
  }

  async listar(vendedorId: string, status: StatusFollowUp, ate?: DataCivil) {
    if (!(await vendedoresRepository.existe(this.prisma, vendedorId))) throw erros.vendedorNaoEncontrado();
    const hoje = this.relogio.hoje();
    const registros = await repo.listarDoVendedor(this.prisma, vendedorId, status, ate);
    // Prioridade (CRITICA, ALTA, MEDIA), vencimento mais antigo, maior valor.
    const itens = registros
      .sort(
        (a, b) =>
          pesoPrioridade(a.prioridade) - pesoPrioridade(b.prioridade) ||
          a.venceEm.getTime() - b.venceEm.getTime() ||
          Number(b.oportunidade.valorEstimado ?? 0) - Number(a.oportunidade.valorEstimado ?? 0),
      )
      .map((f) => this.toDTO(f, hoje));
    return { hoje, total: itens.length, itens };
  }

  /**
   * Vendedor marca a ação como feita. Por padrão registra o contato de hoje; depois o motor decide
   * se ainda há o que fazer (ex.: proposta continua vencida → nova ação do mesmo tipo).
   */
  async concluir(
    id: string,
    corpo: { registrarContato: boolean; observacao?: string },
    _executor: Executor,
  ) {
    const oportunidades = this.oportunidades();
    const oportunidadeId = await this.prisma.$transaction(async (tx) => {
      const f = await repo.buscar(tx, id);
      if (!f) throw erros.followUpNaoEncontrado();
      // Encerramento condicional: duas conclusões simultâneas não passam as duas.
      if ((await repo.concluirSeAberto(tx, id, this.relogio.agora())) === 0) throw erros.followUpJaEncerrado();
      if (corpo.registrarContato) {
        await oportunidades.aplicarContato(tx, f.oportunidadeId, { observacao: corpo.observacao });
      } else if (corpo.observacao) {
        await oportunidades.anotar(tx, f.oportunidadeId, corpo.observacao);
      }
      return f.oportunidadeId;
    });

    // A conclusão já foi gravada: falha no recálculo vai para o log (o job corrige) e não vira 500.
    await this.aoAlterar(oportunidadeId);
    const concluido = await repo.buscarComOportunidade(this.prisma, id);
    return {
      followUp: this.toDTO(concluido, this.relogio.hoje()),
      oportunidade: await oportunidades.detalhe(oportunidadeId),
    };
  }
}
