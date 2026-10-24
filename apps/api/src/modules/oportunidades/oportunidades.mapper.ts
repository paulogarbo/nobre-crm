import type {
  FollowUpDaOportunidadeDTO,
  HistoricoDTO,
  OportunidadeDetalheDTO,
  OportunidadeResumoDTO,
} from '@nobre/contracts';
import {
  ROTULOS,
  avaliarAtencao,
  diasEntre,
  hojeDataCivil,
  transicoesPermitidas,
  type DataCivil,
  type OportunidadeDominio,
} from '@nobre/domain';
import type { FollowUp, ItemBrinde, Oportunidade, Prisma } from '../../generated/prisma/client';
import { deDataBanco, deDataBancoOuNull } from '../../lib/datas-banco';
import type { OportunidadeComDetalhe, OportunidadeComResumo } from './oportunidades.repository';

const numeroOuNull = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

/** Prisma → objeto puro do domínio (sem Decimal, sem Date). */
export function paraDominio(op: Oportunidade & { itens: ItemBrinde[] }): OportunidadeDominio {
  return {
    id: op.id,
    codigo: op.codigo,
    etapa: op.etapa,
    valorEstimado: numeroOuNull(op.valorEstimado),
    itens: op.itens.map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      valorUnitario: numeroOuNull(i.valorUnitario),
    })),
    ultimoContato: deDataBancoOuNull(op.ultimoContato),
    validadeProposta: deDataBancoOuNull(op.validadeProposta),
    eventoCliente: deDataBancoOuNull(op.eventoCliente),
    motivoPerda: op.motivoPerda,
    // createdAt é um instante: a data civil da criação é a de Brasília, não a de UTC.
    criadaEm: hojeDataCivil(op.createdAt),
  };
}

export function followUpDaOportunidadeDTO(f: FollowUp): FollowUpDaOportunidadeDTO {
  return {
    id: f.id,
    tipo: f.tipo,
    prioridade: f.prioridade,
    titulo: f.titulo,
    descricao: f.descricao,
    venceEm: deDataBanco(f.venceEm),
    status: f.status,
    criadoEm: f.criadoEm.toISOString(),
    encerradoEm: f.encerradoEm?.toISOString() ?? null,
  };
}

export function paraResumo(op: OportunidadeComResumo | OportunidadeComDetalhe, hoje: DataCivil): OportunidadeResumoDTO {
  const dominio = paraDominio(op);
  const atencao = avaliarAtencao(dominio, hoje);
  const aberto = op.followUps.find((f) => f.status === 'ABERTO') ?? null;
  return {
    id: op.id,
    codigo: op.codigo,
    empresa: op.empresa,
    etapa: dominio.etapa,
    etapaRotulo: ROTULOS[dominio.etapa],
    vendedor: { id: op.vendedor.id, nome: op.vendedor.nome },
    valorEstimado: dominio.valorEstimado,
    itens: op.itens.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      quantidade: i.quantidade,
      valorUnitario: numeroOuNull(i.valorUnitario),
    })),
    ultimoContato: dominio.ultimoContato,
    validadeProposta: dominio.validadeProposta,
    eventoCliente: dominio.eventoCliente,
    diasSemContato: dominio.ultimoContato ? diasEntre(dominio.ultimoContato, hoje) : null,
    atencao: {
      severidade: atencao.severidade,
      score: atencao.score,
      sinais: atencao.sinais.map((s) => ({ tipo: s.tipo, severidade: s.severidade, mensagem: s.mensagem })),
    },
    proximaAcao: aberto
      ? {
          id: aberto.id,
          tipo: aberto.tipo,
          prioridade: aberto.prioridade,
          titulo: aberto.titulo,
          venceEm: deDataBanco(aberto.venceEm),
        }
      : null,
    transicoesPermitidas: transicoesPermitidas(dominio, hoje),
    createdAt: op.createdAt.toISOString(),
    updatedAt: op.updatedAt.toISOString(),
  };
}

export function historicoDTO(t: OportunidadeComDetalhe['transicoes'][number]): HistoricoDTO {
  return {
    id: t.id,
    deEtapa: t.deEtapa,
    paraEtapa: t.paraEtapa,
    motivo: t.motivo,
    vendedor: { id: t.vendedor.id, nome: t.vendedor.nome },
    createdAt: t.createdAt.toISOString(),
  };
}

export function paraDetalhe(op: OportunidadeComDetalhe, hoje: DataCivil): OportunidadeDetalheDTO {
  return {
    ...paraResumo(op, hoje),
    cnpj: op.cnpj,
    contatoNome: op.contatoNome,
    contatoEmail: op.contatoEmail,
    contatoTelefone: op.contatoTelefone,
    motivoPerda: op.motivoPerda,
    observacoes: op.observacoes,
    historico: op.transicoes.map(historicoDTO),
    followUps: op.followUps.map(followUpDaOportunidadeDTO),
  };
}
