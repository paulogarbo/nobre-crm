import {
  ETAPAS_FINAIS,
  ROTULOS,
  diasEntre,
  pesoPrioridade,
  proximaAcao,
  type DataCivil,
  type Etapa,
  type Prioridade,
} from '@nobre/domain';
import { Prisma, type FollowUp } from '../../generated/prisma/client';
import type { Relogio } from '../../lib/clock';
import { deDataBanco, paraDataBanco } from '../../lib/datas-banco';
import { erros } from '../../lib/errors';
import type { PrismaClient } from '../../lib/prisma';
import { followUpDaOportunidadeDTO, paraDominio } from '../oportunidades/oportunidades.mapper';
import type { AoAlterarOportunidade, Executor, OportunidadesService } from '../oportunidades/oportunidades.service';
import type { FollowUpDTO, StatusFollowUp } from './follow-ups.schemas';

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

const includeOportunidade = {
  oportunidade: { include: { vendedor: { select: { id: true, nome: true } } } },
} as const satisfies Prisma.FollowUpInclude;
type FollowUpComOportunidade = Prisma.FollowUpGetPayload<{ include: typeof includeOportunidade }>;

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
    const etapa = f.oportunidade.etapa as Etapa;
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
      const op = await tx.oportunidade.findUnique({
        where: { id: oportunidadeId },
        include: { itens: true, vendedor: { select: { nome: true } }, followUps: { where: { status: 'ABERTO' } } },
      });
      const r = zero();
      if (!op) return r;

      const aberto: FollowUp | undefined = op.followUps[0];
      const acao = proximaAcao(paraDominio(op), hoje); // finais → null

      if (!acao) {
        if (aberto) {
          await tx.followUp.update({ where: { id: aberto.id }, data: { status: 'RESOLVIDO', encerradoEm: agora } });
          r.resolvidos++;
        }
        return r;
      }

      if (aberto && aberto.tipo === acao.tipo) {
        // Mesmo motivo: atualiza textos/prioridade e mantém o vencimento original (preserva o "atrasado").
        if (aberto.prioridade !== acao.prioridade || aberto.titulo !== acao.titulo || aberto.descricao !== acao.descricao) {
          await tx.followUp.update({
            where: { id: aberto.id },
            data: { prioridade: acao.prioridade, titulo: acao.titulo, descricao: acao.descricao },
          });
        }
        r.mantidos++;
        return r;
      }

      if (aberto) {
        await tx.followUp.update({ where: { id: aberto.id }, data: { status: 'SUBSTITUIDO', encerradoEm: agora } });
        r.substituidos++;
      } else {
        r.criados++;
      }
      await tx.followUp.create({
        data: {
          oportunidadeId: op.id,
          tipo: acao.tipo,
          prioridade: acao.prioridade,
          titulo: acao.titulo,
          descricao: acao.descricao,
          venceEm: paraDataBanco(hoje),
          status: 'ABERTO',
          criadoEm: agora,
        },
      });
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
    const alvos = await this.prisma.oportunidade.findMany({
      where: { OR: [{ etapa: { notIn: [...ETAPAS_FINAIS] } }, { followUps: { some: { status: 'ABERTO' } } }] },
      select: { id: true },
      orderBy: { codigo: 'asc' },
    });
    const novas: AcaoNova[] = [];
    let total = zero();
    for (const { id } of alvos) total = somar(total, await this.recalcularPara(id, novas));
    return { hoje: this.relogio.hoje(), ...total, novas };
  }

  async listar(vendedorId: string, status: StatusFollowUp, ate?: DataCivil) {
    const vendedor = await this.prisma.vendedor.findUnique({ where: { id: vendedorId }, select: { id: true } });
    if (!vendedor) throw erros.vendedorNaoEncontrado();
    const hoje = this.relogio.hoje();
    const registros = await this.prisma.followUp.findMany({
      where: {
        status,
        oportunidade: { vendedorId },
        ...(ate ? { venceEm: { lte: paraDataBanco(ate) } } : {}),
      },
      include: includeOportunidade,
    });
    // Prioridade (CRITICA, ALTA, MEDIA), vencimento mais antigo, maior valor.
    const itens = registros
      .sort(
        (a, b) =>
          pesoPrioridade(a.prioridade as Prioridade) - pesoPrioridade(b.prioridade as Prioridade) ||
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
      const f = await tx.followUp.findUnique({ where: { id } });
      if (!f) throw erros.followUpNaoEncontrado();
      // Encerramento condicional: duas conclusões simultâneas não passam as duas.
      const { count } = await tx.followUp.updateMany({
        where: { id, status: 'ABERTO' },
        data: { status: 'CONCLUIDO', encerradoEm: this.relogio.agora() },
      });
      if (count === 0) throw erros.followUpJaEncerrado();
      if (corpo.registrarContato) {
        await oportunidades.aplicarContato(tx, f.oportunidadeId, { observacao: corpo.observacao });
      } else if (corpo.observacao) {
        await oportunidades.anotar(tx, f.oportunidadeId, corpo.observacao);
      }
      return f.oportunidadeId;
    });

    // A conclusão já foi gravada: falha no recálculo vai para o log (o job corrige) e não vira 500.
    await this.aoAlterar(oportunidadeId);
    const concluido = await this.prisma.followUp.findUniqueOrThrow({ where: { id }, include: includeOportunidade });
    return {
      followUp: this.toDTO(concluido, this.relogio.hoje()),
      oportunidade: await oportunidades.detalhe(oportunidadeId),
    };
  }
}
