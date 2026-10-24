import {
  ROTULOS,
  avaliarAtencao,
  diasEntre,
  transicoesPermitidas,
  type DataCivil,
  type Etapa,
  type OportunidadeDominio,
  type Prioridade,
  type TipoFollowUp,
} from '@nobre/domain';
import type { FollowUp, ItemBrinde, Oportunidade, Prisma } from '../../generated/prisma/client';
import { deDataBanco, deDataBancoOuNull } from '../../lib/datas-banco';
import type { OportunidadeComDetalhe, OportunidadeComResumo } from './oportunidades.repository';
import type {
  FollowUpDaOportunidadeDTO,
  HistoricoDTO,
  OportunidadeDetalheDTO,
  OportunidadeResumoDTO,
} from './oportunidades.schemas';

const numeroOuNull = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

/** Prisma → objeto puro do domínio (sem Decimal, sem Date). */
export function paraDominio(op: Oportunidade & { itens: ItemBrinde[] }): OportunidadeDominio {
  return {
    id: op.id,
    codigo: op.codigo,
    etapa: op.etapa as Etapa,
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
    criadaEm: deDataBanco(op.createdAt),
  };
}

export function followUpDaOportunidadeDTO(f: FollowUp): FollowUpDaOportunidadeDTO {
  return {
    id: f.id,
    tipo: f.tipo as TipoFollowUp,
    prioridade: f.prioridade as Prioridade,
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
          tipo: aberto.tipo as TipoFollowUp,
          prioridade: aberto.prioridade as Prioridade,
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
    deEtapa: (t.deEtapa as Etapa | null) ?? null,
    paraEtapa: t.paraEtapa as Etapa,
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
