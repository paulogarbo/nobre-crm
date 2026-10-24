// Como o front apresenta conceitos do domínio (cores, rótulos curtos). Nenhuma regra de negócio aqui:
// regras vêm de @nobre/domain e a palavra final é sempre do servidor.
import {
  Etapa,
  TipoSinal,
  diasEntre,
  type OportunidadeDominio,
  type Prioridade,
  type Severidade,
} from '@nobre/domain';
import type { OportunidadeResumo, SinalDTO } from './api/tipos';

/** DTO da API → objeto do domínio (para `motivoDeBloqueio`, que explica destinos inválidos). */
export function paraDominio(op: OportunidadeResumo): OportunidadeDominio {
  return {
    id: op.id,
    codigo: op.codigo,
    etapa: op.etapa,
    valorEstimado: op.valorEstimado,
    itens: op.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, valorUnitario: i.valorUnitario })),
    ultimoContato: op.ultimoContato,
    validadeProposta: op.validadeProposta,
    eventoCliente: op.eventoCliente,
    motivoPerda: null,
  };
}

interface Estilo {
  rotulo: string;
  texto: string;
  fundo: string;
  borda: string;
  ponto: string;
}

/** Paleta semântica única (badge, borda do card, resumo, painel Hoje, timeline). */
export const ESTILO_SEVERIDADE: Record<Severidade, Estilo> = {
  CRITICA: { rotulo: 'Crítica', texto: 'text-red-700', fundo: 'bg-red-50', borda: 'border-l-red-600', ponto: 'bg-red-600' },
  ALTA: { rotulo: 'Alta', texto: 'text-orange-700', fundo: 'bg-orange-50', borda: 'border-l-orange-500', ponto: 'bg-orange-500' },
  MEDIA: { rotulo: 'Média', texto: 'text-amber-800', fundo: 'bg-amber-50', borda: 'border-l-amber-400', ponto: 'bg-amber-400' },
  BAIXA: { rotulo: 'Baixa', texto: 'text-slate-600', fundo: 'bg-slate-100', borda: 'border-l-slate-400', ponto: 'bg-slate-400' },
};

export const ESTILO_PRIORIDADE: Record<Prioridade, Estilo> = {
  CRITICA: ESTILO_SEVERIDADE.CRITICA,
  ALTA: ESTILO_SEVERIDADE.ALTA,
  MEDIA: ESTILO_SEVERIDADE.MEDIA,
};

/** Cor neutra por etapa (não compete com a severidade); finais com verde/cinza. */
export const ESTILO_ETAPA: Record<Etapa, string> = {
  PRIMEIRO_CONTATO: 'bg-sky-50 text-sky-800 ring-sky-200',
  APRESENTACAO_ORCAMENTO: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  FOLLOW_UP: 'bg-violet-50 text-violet-800 ring-violet-200',
  FORECAST: 'bg-teal-50 text-teal-800 ring-teal-200',
  FECHAMENTO: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  PERDIDA: 'bg-slate-100 text-slate-600 ring-slate-300',
};

/** Rótulo curto do badge no card ("Evento em 3d"); a mensagem completa vai no tooltip. */
export function rotuloCurtoSinal(sinal: SinalDTO, op: OportunidadeResumo, hoje: string): string {
  switch (sinal.tipo) {
    case TipoSinal.EVENTO_PASSOU:
      return 'Evento passou';
    case TipoSinal.EVENTO_PROXIMO: {
      const n = op.eventoCliente ? diasEntre(hoje, op.eventoCliente) : null;
      return n === 0 ? 'Evento hoje' : `Evento em ${n}d`;
    }
    case TipoSinal.PROPOSTA_VENCIDA:
      return 'Proposta vencida';
    case TipoSinal.PROPOSTA_VENCE_EM_BREVE: {
      const n = op.validadeProposta ? diasEntre(hoje, op.validadeProposta) : null;
      return n === 0 ? 'Vence hoje' : `Vence em ${n}d`;
    }
    case TipoSinal.SEM_CONTATO:
      if (op.etapa === Etapa.PRIMEIRO_CONTATO) return 'Lead sem contato';
      return op.diasSemContato === null ? 'Sem contato' : `${op.diasSemContato}d sem contato`;
    case TipoSinal.DADOS_INCOMPLETOS:
      return 'Dados incompletos';
    default:
      return sinal.mensagem;
  }
}
