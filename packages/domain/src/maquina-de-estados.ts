import { diasEntre, type DataCivil } from './datas';
import { Etapa, ehFinal, indiceNoFunil, proximaEtapa } from './etapas';
import { CodigoErroDominio, mensagens, type CampoFaltante } from './erros';
import type { OportunidadeDominio } from './tipos';

export type ResultadoTransicao =
  | { ok: true }
  | { ok: false; code: CodigoErroDominio; message: string; details?: Record<string, unknown> };

export type TipoTransicao = 'avanco' | 'retorno' | 'perda';

export interface TransicaoPermitida {
  para: Etapa;
  exigeMotivo: boolean;
  tipo: TipoTransicao;
}

/** Tamanho mínimo do motivo (perda e retorno), após trim. */
export const MOTIVO_MIN_CARACTERES = 5;

/**
 * Retornos permitidos (R-RET-1, R-RET-2, R-RET-3). Qualquer outro retorno é bloqueado;
 * em especial, nada volta para Primeiro Contato (R-RET-4).
 */
const RETORNOS_PERMITIDOS: ReadonlyMap<Etapa, readonly Etapa[]> = new Map([
  [Etapa.FOLLOW_UP, [Etapa.APRESENTACAO_ORCAMENTO]],
  [Etapa.FORECAST, [Etapa.FOLLOW_UP, Etapa.APRESENTACAO_ORCAMENTO]],
]);

const OK: ResultadoTransicao = { ok: true };

function falha(
  code: CodigoErroDominio,
  message: string,
  details?: Record<string, unknown>,
): ResultadoTransicao {
  return details ? { ok: false, code, message, details } : { ok: false, code, message };
}

export function motivoValido(motivo: string | null | undefined): boolean {
  return typeof motivo === 'string' && motivo.trim().length >= MOTIVO_MIN_CARACTERES;
}

/** Retorno estrutural: as duas etapas estão no funil linear e o destino vem antes da origem. */
export function ehRetorno(de: Etapa, para: Etapa): boolean {
  const i = indiceNoFunil(de);
  const j = indiceNoFunil(para);
  return i >= 0 && j >= 0 && j < i;
}

function retornoPermitido(de: Etapa, para: Etapa): boolean {
  return RETORNOS_PERMITIDOS.get(de)?.includes(para) ?? false;
}

/** Campos que faltam para apresentar orçamento (R-PRE-1 e R-PRE-2), em ordem fixa. */
export function camposFaltantesParaApresentar(op: OportunidadeDominio): CampoFaltante[] {
  const faltando: CampoFaltante[] = [];
  if (op.valorEstimado === null || !(op.valorEstimado > 0)) faltando.push('valorEstimado');
  if (!op.itens.some((item) => item.quantidade > 0)) faltando.push('itens');
  if (op.validadeProposta === null) faltando.push('validadeProposta');
  return faltando;
}

/** Pré-condições de dados da etapa de destino (R-PRE-1, R-PRE-2, R-PRE-3). */
function validarPreCondicoes(op: OportunidadeDominio, para: Etapa, hoje: DataCivil): ResultadoTransicao {
  if (para === Etapa.APRESENTACAO_ORCAMENTO) {
    const faltando = camposFaltantesParaApresentar(op);
    if (faltando.length > 0) {
      return falha(CodigoErroDominio.PRE_CONDICAO_NAO_ATENDIDA, mensagens.preCondicaoApresentacao(faltando), {
        faltando,
      });
    }
  }
  if (para === Etapa.FORECAST) {
    // Sem validade é dado inconsistente (toda proposta apresentada tem validade): tratado como
    // pré-condição não atendida, que diz ao vendedor exatamente o que preencher.
    if (op.validadeProposta === null) {
      const faltando: CampoFaltante[] = ['validadeProposta'];
      return falha(CodigoErroDominio.PRE_CONDICAO_NAO_ATENDIDA, mensagens.preCondicaoForecast(faltando), {
        faltando,
      });
    }
    if (diasEntre(hoje, op.validadeProposta) < 0) {
      return falha(CodigoErroDominio.PROPOSTA_VENCIDA, mensagens.propostaVencida(op.validadeProposta), {
        validadeProposta: op.validadeProposta,
      });
    }
  }
  return OK;
}

/**
 * Valida a transição `op.etapa → para`. Ordem de avaliação (define qual erro é devolvido):
 * R-MESMA → R-FINAL → PERDIDA (R-PERDA) → retorno (R-RET-4, permitido?, R-RET-MOTIVO)
 * → avanço (R-FECH, R-SALTO, pré-condições do destino).
 */
export function validarTransicao(
  op: OportunidadeDominio,
  para: Etapa,
  motivo: string | null | undefined,
  hoje: DataCivil,
): ResultadoTransicao {
  const de = op.etapa;

  if (para === de) return falha(CodigoErroDominio.MESMA_ETAPA, mensagens.mesmaEtapa());
  if (ehFinal(de)) return falha(CodigoErroDominio.ETAPA_FINAL, mensagens.etapaFinal());

  if (para === Etapa.PERDIDA) {
    return motivoValido(motivo)
      ? OK
      : falha(CodigoErroDominio.MOTIVO_PERDA_OBRIGATORIO, mensagens.motivoPerdaObrigatorio());
  }

  if (ehRetorno(de, para)) {
    if (para === Etapa.PRIMEIRO_CONTATO || !retornoPermitido(de, para)) {
      return falha(CodigoErroDominio.RETORNO_NAO_PERMITIDO, mensagens.retornoNaoPermitido(para));
    }
    return motivoValido(motivo)
      ? OK
      : falha(CodigoErroDominio.MOTIVO_RETORNO_OBRIGATORIO, mensagens.motivoRetornoObrigatorio());
  }

  // Avanço. R-FECH antes de R-SALTO: a mensagem específica é mais útil ao vendedor.
  if (para === Etapa.FECHAMENTO && de !== Etapa.FORECAST) {
    return falha(CodigoErroDominio.FECHAMENTO_SO_DE_FORECAST, mensagens.fechamentoSoDeForecast());
  }
  const proxima = proximaEtapa(de);
  if (proxima === null || para !== proxima) {
    return falha(
      CodigoErroDominio.SALTO_DE_ETAPA,
      proxima ? mensagens.saltoDeEtapa(de, proxima) : mensagens.etapaFinal(),
      proxima ? { proxima } : undefined,
    );
  }

  return validarPreCondicoes(op, para, hoje);
}

/** Destinos possíveis olhando só a etapa (sem dados da oportunidade). Matriz de transições. */
export function transicoesEstruturais(de: Etapa): TransicaoPermitida[] {
  if (ehFinal(de)) return [];
  const lista: TransicaoPermitida[] = [];
  const proxima = proximaEtapa(de);
  if (proxima) lista.push({ para: proxima, exigeMotivo: false, tipo: 'avanco' });
  for (const para of RETORNOS_PERMITIDOS.get(de) ?? []) {
    lista.push({ para, exigeMotivo: true, tipo: 'retorno' });
  }
  lista.push({ para: Etapa.PERDIDA, exigeMotivo: true, tipo: 'perda' });
  return lista;
}

// Motivo fictício que satisfaz R-PERDA/R-RET-MOTIVO: serve para avaliar só regras estruturais e de dados.
const MOTIVO_SIMULADO = 'motivo informado pelo vendedor';

/** Destinos possíveis já aplicando as pré-condições de dados. Usado pela UI para desabilitar colunas. */
export function transicoesPermitidas(op: OportunidadeDominio, hoje: DataCivil): TransicaoPermitida[] {
  return transicoesEstruturais(op.etapa).filter((t) => validarTransicao(op, t.para, MOTIVO_SIMULADO, hoje).ok);
}

/**
 * Por que a oportunidade não pode ir para `para` (ignorando a exigência de motivo, que a UI pede depois).
 * `null` quando o destino é possível.
 */
export function motivoDeBloqueio(op: OportunidadeDominio, para: Etapa, hoje: DataCivil): string | null {
  const resultado = validarTransicao(op, para, MOTIVO_SIMULADO, hoje);
  return resultado.ok ? null : resultado.message;
}
