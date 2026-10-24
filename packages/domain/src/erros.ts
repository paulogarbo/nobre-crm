import { formatarDataBR, type DataCivil } from './datas';
import { ROTULOS, type Etapa } from './etapas';

export const CodigoErroDominio = {
  MESMA_ETAPA: 'MESMA_ETAPA',
  ETAPA_FINAL: 'ETAPA_FINAL',
  MOTIVO_PERDA_OBRIGATORIO: 'MOTIVO_PERDA_OBRIGATORIO',
  MOTIVO_RETORNO_OBRIGATORIO: 'MOTIVO_RETORNO_OBRIGATORIO',
  RETORNO_NAO_PERMITIDO: 'RETORNO_NAO_PERMITIDO',
  SALTO_DE_ETAPA: 'SALTO_DE_ETAPA',
  FECHAMENTO_SO_DE_FORECAST: 'FECHAMENTO_SO_DE_FORECAST',
  PRE_CONDICAO_NAO_ATENDIDA: 'PRE_CONDICAO_NAO_ATENDIDA',
  PROPOSTA_VENCIDA: 'PROPOSTA_VENCIDA',
} as const;

export type CodigoErroDominio = (typeof CodigoErroDominio)[keyof typeof CodigoErroDominio];

/** Campos que podem faltar para cumprir uma pré-condição, na ordem fixa em que são reportados. */
export type CampoFaltante = 'valorEstimado' | 'itens' | 'validadeProposta';

export const ROTULOS_CAMPOS: Record<CampoFaltante, string> = {
  valorEstimado: 'valor estimado',
  itens: 'ao menos um item de brinde',
  validadeProposta: 'validade da proposta',
};

/** "a", "a e b", "a, b e c". */
export function listaLegivel(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

export function listarCampos(campos: CampoFaltante[]): string {
  return listaLegivel(campos.map((c) => ROTULOS_CAMPOS[c]));
}

/** Mensagens voltadas ao vendedor (exibidas na UI tal como o servidor devolve). */
export const mensagens = {
  mesmaEtapa: () => 'A oportunidade já está nesta etapa.',
  etapaFinal: () => 'Oportunidades em Fechamento ou Perdida não podem mudar de etapa.',
  motivoPerdaObrigatorio: () => 'Informe o motivo da perda para marcar a oportunidade como Perdida.',
  motivoRetornoObrigatorio: () => 'Informe o motivo para retornar a oportunidade de etapa.',
  retornoNaoPermitido: (para: Etapa) =>
    `Não é possível voltar para ${ROTULOS[para]}: uma proposta apresentada não volta a Primeiro Contato. ` +
    'Corrija os dados da oportunidade se necessário.',
  saltoDeEtapa: (de: Etapa, proxima: Etapa) =>
    `Avance uma etapa por vez: de ${ROTULOS[de]} a próxima etapa é ${ROTULOS[proxima]}.`,
  fechamentoSoDeForecast: () => 'Só é possível fechar uma oportunidade que esteja em Forecast.',
  preCondicaoApresentacao: (campos: CampoFaltante[]) =>
    `Para apresentar o orçamento, informe: ${listarCampos(campos)}.`,
  preCondicaoForecast: (campos: CampoFaltante[]) =>
    `Para colocar em Forecast, informe: ${listarCampos(campos)}.`,
  propostaVencida: (validade: DataCivil) =>
    `A proposta venceu em ${formatarDataBR(validade)}. Revise a proposta (volte para Apresentação de Orçamento) ` +
    'antes de colocar em Forecast.',
};
