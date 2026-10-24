import type {
  CorpoCriar,
  CorpoEditar,
  OportunidadeDetalheDTO,
  OportunidadeResumoDTO,
  Ordem,
  QueryListarOportunidades,
} from '@nobre/contracts';
import {
  atingeSeveridade,
  compararCodigo,
  compararPrioridade,
  diasEntre,
  ehFinal,
  formatarDataBR,
  type DataCivil,
} from '@nobre/domain';
import { Prisma } from '../../generated/prisma/client';
import type { Relogio } from '../../lib/clock';
import { paraDataBanco, paraDataBancoOuNull } from '../../lib/datas-banco';
import { erros } from '../../lib/errors';
import type { PrismaClient } from '../../lib/prisma';
import { paraDetalhe, paraResumo, historicoDTO } from './oportunidades.mapper';
import { vendedoresRepository } from '../vendedores/vendedores.repository';
import { oportunidadesRepository as repo } from './oportunidades.repository';

export interface Executor {
  id: string;
  nome: string;
}

/** Chamado após cada alteração já commitada (recalcula o follow-up da oportunidade). */
export type AoAlterarOportunidade = (oportunidadeId: string) => Promise<void>;

const TENTATIVAS_CODIGO = 3;

function exigirContatoNaoFuturo(data: DataCivil | null | undefined, hoje: DataCivil, campo: string) {
  if (data && diasEntre(hoje, data) > 0) {
    const mensagem = `não pode ser posterior a hoje (${formatarDataBR(hoje)})`;
    throw erros.validacao(`Dados inválidos (corpo). ${campo}: ${mensagem}`, {
      issues: [{ local: 'body', campo, mensagem }],
    });
  }
}

function ordenar(itens: OportunidadeResumoDTO[], ordem: Ordem): OportunidadeResumoDTO[] {
  const porCodigo = (a: OportunidadeResumoDTO, b: OportunidadeResumoDTO) => compararCodigo(a.codigo, b.codigo);
  const comparadores: Record<Ordem, (a: OportunidadeResumoDTO, b: OportunidadeResumoDTO) => number> = {
    prioridade: (a, b) =>
      compararPrioridade({ ...a, score: a.atencao.score }, { ...b, score: b.atencao.score }),
    valor: (a, b) => (b.valorEstimado ?? 0) - (a.valorEstimado ?? 0) || porCodigo(a, b),
    // contato mais antigo primeiro; nunca contatado vem antes de todos
    ultimoContato: (a, b) =>
      (a.ultimoContato ?? '').localeCompare(b.ultimoContato ?? '') || porCodigo(a, b),
    codigo: porCodigo,
  };
  return [...itens].sort(comparadores[ordem]);
}

/** Observações são texto livre; registros datados entram como novas linhas "[YYYY-MM-DD] texto". */
function anexar(observacoes: string | null, data: DataCivil, texto: string): string {
  const linha = `[${data}] ${texto}`;
  return observacoes ? `${observacoes}\n${linha}` : linha;
}

function ehCodigoDuplicado(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}

export class OportunidadesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly relogio: Relogio,
    private readonly aoAlterar: AoAlterarOportunidade,
  ) {}

  async listar(query: QueryListarOportunidades) {
    const hoje = this.relogio.hoje();
    const registros = await repo.listar(this.prisma, {
      q: query.q,
      etapas: query.etapa,
      vendedorId: query.vendedorId,
      incluirFinais: query.incluirFinais,
    });
    let itens = registros.map((r) => paraResumo(r, hoje));
    if (query.atencao) itens = itens.filter((i) => i.atencao.sinais.length > 0);
    const severidadeMinima = query.severidade;
    if (severidadeMinima) itens = itens.filter((i) => atingeSeveridade(i.atencao.severidade, severidadeMinima));
    itens = ordenar(itens, query.ordem);
    return { hoje, total: itens.length, itens };
  }

  async detalhe(idOuCodigo: string): Promise<OportunidadeDetalheDTO> {
    const op = await repo.buscarDetalhe(this.prisma, idOuCodigo);
    if (!op) throw erros.oportunidadeNaoEncontrada();
    return paraDetalhe(op, this.relogio.hoje());
  }

  async historico(idOuCodigo: string) {
    const op = await repo.buscarDetalhe(this.prisma, idOuCodigo);
    if (!op) throw erros.oportunidadeNaoEncontrada();
    return { itens: op.transicoes.map(historicoDTO) };
  }

  private async exigirVendedor(id: string) {
    if (!(await vendedoresRepository.existe(this.prisma, id))) throw erros.vendedorNaoEncontrado();
  }

  async criar(corpo: CorpoCriar, executor: Executor): Promise<OportunidadeDetalheDTO> {
    const hoje = this.relogio.hoje();
    exigirContatoNaoFuturo(corpo.ultimoContato, hoje, 'ultimoContato');
    const vendedorId = corpo.vendedorId ?? executor.id;
    if (corpo.vendedorId) await this.exigirVendedor(corpo.vendedorId);

    for (let tentativa = 0; tentativa < TENTATIVAS_CODIGO; tentativa++) {
      try {
        const id = await this.prisma.$transaction(async (tx) => {
          const codigo = `OPP-${await repo.proximoNumeroDeCodigo(tx)}`;
          const agora = this.relogio.agora();
          // A criação também é um evento do histórico: "criada em Primeiro Contato".
          const op = await repo.inserir(
            tx,
            {
              codigo,
              empresa: corpo.empresa,
              vendedorId,
              cnpj: corpo.cnpj ?? null,
              contatoNome: corpo.contatoNome ?? null,
              contatoEmail: corpo.contatoEmail ?? null,
              contatoTelefone: corpo.contatoTelefone ?? null,
              valorEstimado: corpo.valorEstimado ?? null,
              ultimoContato: paraDataBancoOuNull(corpo.ultimoContato),
              validadeProposta: paraDataBancoOuNull(corpo.validadeProposta),
              eventoCliente: paraDataBancoOuNull(corpo.eventoCliente),
              observacoes: corpo.observacoes ?? null,
            },
            corpo.itens ?? [],
            executor.id,
            agora,
          );
          return op.id;
        });
        await this.aoAlterar(id);
        return this.detalhe(id);
      } catch (erro) {
        // código já usado fora da sequência (ex.: gravado à mão): a próxima tentativa pega o número seguinte
        if (ehCodigoDuplicado(erro) && tentativa < TENTATIVAS_CODIGO - 1) continue;
        if (ehCodigoDuplicado(erro)) throw erros.codigoDuplicado();
        throw erro;
      }
    }
    throw erros.codigoDuplicado();
  }

  async editar(idOuCodigo: string, corpo: CorpoEditar): Promise<OportunidadeDetalheDTO> {
    const atual = await repo.buscarEtapa(this.prisma, idOuCodigo);
    if (!atual) throw erros.oportunidadeNaoEncontrada();

    const campos = (Object.keys(corpo) as Array<keyof CorpoEditar>).filter((k) => corpo[k] !== undefined);
    if (ehFinal(atual.etapa) && campos.some((k) => k !== 'observacoes')) {
      throw erros.oportunidadeFinalizada();
    }
    exigirContatoNaoFuturo(corpo.ultimoContato, this.relogio.hoje(), 'ultimoContato');
    if (corpo.vendedorId) await this.exigirVendedor(corpo.vendedorId);

    const data: Prisma.OportunidadeUncheckedUpdateInput = {};
    if (corpo.empresa !== undefined) data.empresa = corpo.empresa;
    if (corpo.vendedorId !== undefined) data.vendedorId = corpo.vendedorId;
    if (corpo.cnpj !== undefined) data.cnpj = corpo.cnpj;
    if (corpo.contatoNome !== undefined) data.contatoNome = corpo.contatoNome;
    if (corpo.contatoEmail !== undefined) data.contatoEmail = corpo.contatoEmail;
    if (corpo.contatoTelefone !== undefined) data.contatoTelefone = corpo.contatoTelefone;
    if (corpo.valorEstimado !== undefined) data.valorEstimado = corpo.valorEstimado;
    if (corpo.ultimoContato !== undefined) data.ultimoContato = paraDataBancoOuNull(corpo.ultimoContato);
    if (corpo.validadeProposta !== undefined) data.validadeProposta = paraDataBancoOuNull(corpo.validadeProposta);
    if (corpo.eventoCliente !== undefined) data.eventoCliente = paraDataBancoOuNull(corpo.eventoCliente);
    if (corpo.observacoes !== undefined) data.observacoes = corpo.observacoes;

    // v1: `itens`, se enviado, substitui a lista anterior inteira (simples e previsível).
    await this.prisma.$transaction((tx) => repo.atualizar(tx, atual.id, data, corpo.itens, this.relogio.agora()));
    await this.aoAlterar(atual.id);
    return this.detalhe(atual.id);
  }

  /** "Registrei contato": atualiza `ultimoContato` (nunca para trás) e, se houver, anota a observação. */
  async registrarContato(
    idOuCodigo: string,
    corpo: { data?: DataCivil; observacao?: string } | undefined,
  ): Promise<OportunidadeDetalheDTO> {
    const id = await this.aplicarContato(this.prisma, idOuCodigo, corpo);
    await this.aoAlterar(id);
    return this.detalhe(id);
  }

  /** Mesma operação dentro de uma transação existente (usada ao concluir um follow-up). Não recalcula. */
  async aplicarContato(
    cliente: PrismaClient | Prisma.TransactionClient,
    idOuCodigo: string,
    corpo: { data?: DataCivil; observacao?: string } | undefined,
  ): Promise<string> {
    const hoje = this.relogio.hoje();
    const atual = await repo.buscarParaContato(cliente, idOuCodigo);
    if (!atual) throw erros.oportunidadeNaoEncontrada();
    if (ehFinal(atual.etapa)) throw erros.oportunidadeFinalizada();

    const data = corpo?.data ?? hoje;
    exigirContatoNaoFuturo(data, hoje, 'data');
    const novo = paraDataBanco(data);
    const ultimoContato = atual.ultimoContato && atual.ultimoContato > novo ? atual.ultimoContato : novo;

    const observacoes = corpo?.observacao ? anexar(atual.observacoes, data, corpo.observacao) : atual.observacoes;
    await repo.gravarContato(cliente, atual.id, ultimoContato, observacoes);
    return atual.id;
  }

  /** Anexa uma observação datada sem mexer no contato. */
  async anotar(cliente: PrismaClient | Prisma.TransactionClient, id: string, observacao: string): Promise<void> {
    const atual = await repo.buscarObservacoes(cliente, id);
    if (!atual) throw erros.oportunidadeNaoEncontrada();
    await repo.gravarObservacoes(cliente, id, anexar(atual.observacoes, this.relogio.hoje(), observacao));
  }
}
