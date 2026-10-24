import { LIMIARES } from './atencao';
import { diasEntre, formatarDataBR, type DataCivil } from './datas';
import { ETAPAS_COM_PROPOSTA, Etapa, ehFinal } from './etapas';
import type { OportunidadeDominio } from './tipos';

/** Tipos de próxima ação (follow-up). Objeto `as const` + união: os mesmos literais dos enums do Prisma, sem conversão. */
export const TipoFollowUp = {
  PRIMEIRO_CONTATO_SLA: 'PRIMEIRO_CONTATO_SLA',
  CONFIRMAR_PRAZO_EVENTO: 'CONFIRMAR_PRAZO_EVENTO',
  REVISAR_PROPOSTA_VENCIDA: 'REVISAR_PROPOSTA_VENCIDA',
  RENEGOCIAR_VALIDADE: 'RENEGOCIAR_VALIDADE',
  CONFIRMAR_RECEBIMENTO_PROPOSTA: 'CONFIRMAR_RECEBIMENTO_PROPOSTA',
  RETOMAR_NEGOCIACAO: 'RETOMAR_NEGOCIACAO',
  CONFIRMAR_FECHAMENTO: 'CONFIRMAR_FECHAMENTO',
} as const;
export type TipoFollowUp = (typeof TipoFollowUp)[keyof typeof TipoFollowUp];

export type Prioridade = 'CRITICA' | 'ALTA' | 'MEDIA';

export const PRIORIDADES: readonly Prioridade[] = ['CRITICA', 'ALTA', 'MEDIA'];

export const ROTULOS_TIPO_FOLLOW_UP: Record<TipoFollowUp, string> = {
  PRIMEIRO_CONTATO_SLA: 'Primeiro contato (SLA)',
  CONFIRMAR_PRAZO_EVENTO: 'Confirmar prazo do evento',
  REVISAR_PROPOSTA_VENCIDA: 'Revisar proposta vencida',
  RENEGOCIAR_VALIDADE: 'Renegociar validade',
  CONFIRMAR_RECEBIMENTO_PROPOSTA: 'Confirmar recebimento da proposta',
  RETOMAR_NEGOCIACAO: 'Retomar negociação',
  CONFIRMAR_FECHAMENTO: 'Confirmar fechamento',
};

export interface ProximaAcao {
  tipo: TipoFollowUp;
  prioridade: Prioridade;
  titulo: string;
  descricao: string;
}

/**
 * Limiares do motor (em dias). Os que coincidem com os sinais de atenção vêm de `LIMIARES` (uma
 * única fonte); os intermediários (confirmar recebimento, retomada preventiva) antecipam a ação
 * antes de virar sinal e só existem aqui.
 */
export const LIMIARES_FOLLOWUP = {
  EVENTO_CRITICO_DIAS: LIMIARES.EVENTO_CRITICO_DIAS,
  EVENTO_ALERTA_DIAS: LIMIARES.EVENTO_ALERTA_DIAS,
  PROPOSTA_VENCENDO_DIAS: LIMIARES.PROPOSTA_VENCENDO_DIAS,
  LEAD_SLA_DIAS: LIMIARES.LEAD_SEM_CONTATO_DIAS,
  CONFIRMAR_RECEBIMENTO_DIAS: 4,
  RETOMADA_PREVENTIVA_DIAS: 6,
  SEM_CONTATO_DIAS: LIMIARES.SEM_CONTATO_DIAS,
} as const;

/** Ordem numérica da prioridade (menor = mais urgente), para ordenar no banco e na UI. */
export function pesoPrioridade(p: Prioridade): number {
  return PRIORIDADES.indexOf(p);
}

function tituloRetomar(dias: number): string {
  return Number.isFinite(dias)
    ? `Retomar negociação (${dias} dias sem contato)`
    : 'Retomar negociação (nenhum contato registrado)';
}

/**
 * A próxima ação da oportunidade: a primeira regra que casar, na ordem de urgência
 * (evento → proposta → contato). Uma única ação por oportunidade; finais → `null`.
 */
export function proximaAcao(op: OportunidadeDominio, hoje: DataCivil): ProximaAcao | null {
  if (ehFinal(op.etapa)) return null;
  const L = LIMIARES_FOLLOWUP;

  // Regras 1–3: evento do cliente (vale para qualquer etapa não final).
  if (op.eventoCliente !== null) {
    const diasEvento = diasEntre(hoje, op.eventoCliente);
    if (diasEvento < 0) {
      return {
        tipo: TipoFollowUp.CONFIRMAR_PRAZO_EVENTO,
        prioridade: 'CRITICA',
        titulo: 'Evento do cliente já passou',
        descricao:
          `O evento era em ${formatarDataBR(op.eventoCliente)}. Confirme com o cliente se ainda há demanda ` +
          'ou marque como Perdida com o motivo.',
      };
    }
    if (diasEvento <= L.EVENTO_CRITICO_DIAS) {
      return {
        tipo: TipoFollowUp.CONFIRMAR_PRAZO_EVENTO,
        prioridade: 'CRITICA',
        titulo: `Confirmar prazo: evento em ${diasEvento} dia(s)`,
        descricao:
          'Alinhe produção e entrega com o cliente hoje. Se não houver tempo, renegocie o escopo ou o prazo.',
      };
    }
    if (diasEvento <= L.EVENTO_ALERTA_DIAS) {
      return {
        tipo: TipoFollowUp.CONFIRMAR_PRAZO_EVENTO,
        prioridade: 'ALTA',
        titulo: `Evento em ${diasEvento} dias: confirmar prazo de produção`,
        descricao: 'Verifique se a produção cabe no prazo e avance a negociação.',
      };
    }
  }

  // Regras 4–5: validade da proposta (só existe proposta a partir de Apresentação de Orçamento).
  if (ETAPAS_COM_PROPOSTA.has(op.etapa) && op.validadeProposta !== null) {
    const diasValidade = diasEntre(hoje, op.validadeProposta);
    if (diasValidade < 0) {
      return {
        tipo: TipoFollowUp.REVISAR_PROPOSTA_VENCIDA,
        prioridade: 'ALTA',
        titulo: `Proposta vencida em ${formatarDataBR(op.validadeProposta)}`,
        descricao:
          'Ligue para o cliente, atualize valores/prazos e reenvie a proposta. Se estiver em Forecast, ' +
          'volte para Apresentação de Orçamento.',
      };
    }
    if (diasValidade <= L.PROPOSTA_VENCENDO_DIAS) {
      return {
        tipo: TipoFollowUp.RENEGOCIAR_VALIDADE,
        prioridade: 'MEDIA',
        titulo: `Proposta vence em ${diasValidade} dia(s)`,
        descricao: 'Confirme a decisão do cliente antes do vencimento ou estenda a validade.',
      };
    }
  }

  // Regras 6–10: tempo sem contato. Nunca ter havido contato conta como infinito.
  const diasSemContato = op.ultimoContato === null ? Infinity : diasEntre(op.ultimoContato, hoje);

  switch (op.etapa) {
    case Etapa.PRIMEIRO_CONTATO:
      if (diasSemContato >= L.LEAD_SLA_DIAS) {
        return {
          tipo: TipoFollowUp.PRIMEIRO_CONTATO_SLA,
          prioridade: 'ALTA',
          titulo: 'Lead aguardando primeiro contato',
          descricao: 'Faça o primeiro contato hoje. SLA de atendimento: até 1 dia útil.',
        };
      }
      break;
    case Etapa.APRESENTACAO_ORCAMENTO:
      if (diasSemContato >= L.CONFIRMAR_RECEBIMENTO_DIAS) {
        return {
          tipo: TipoFollowUp.CONFIRMAR_RECEBIMENTO_PROPOSTA,
          prioridade: 'MEDIA',
          titulo: 'Confirmar recebimento da proposta',
          descricao: 'Pergunte se a proposta chegou e se há dúvidas. Avance para Follow-up.',
        };
      }
      break;
    case Etapa.FOLLOW_UP:
      if (diasSemContato >= L.RETOMADA_PREVENTIVA_DIAS) {
        return {
          tipo: TipoFollowUp.RETOMAR_NEGOCIACAO,
          prioridade: diasSemContato >= L.SEM_CONTATO_DIAS ? 'ALTA' : 'MEDIA',
          titulo: tituloRetomar(diasSemContato),
          descricao: 'Retome o contato e descubra o que falta para decidir.',
        };
      }
      break;
    case Etapa.FORECAST:
      if (diasSemContato >= L.SEM_CONTATO_DIAS) {
        return {
          tipo: TipoFollowUp.CONFIRMAR_FECHAMENTO,
          prioridade: 'ALTA',
          titulo: 'Confirmar fechamento',
          descricao: 'A oportunidade está prevista. Confirme a assinatura/pedido e feche.',
        };
      }
      break;
    default:
      break;
  }

  return null;
}
