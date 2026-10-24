export enum Etapa {
  PRIMEIRO_CONTATO = 'PRIMEIRO_CONTATO',
  APRESENTACAO_ORCAMENTO = 'APRESENTACAO_ORCAMENTO',
  FOLLOW_UP = 'FOLLOW_UP',
  FORECAST = 'FORECAST',
  FECHAMENTO = 'FECHAMENTO',
  PERDIDA = 'PERDIDA',
}

/** Ordem linear do funil. PERDIDA fica fora: pode ser aplicada a partir de qualquer etapa não final. */
export const ORDEM_FUNIL: readonly Etapa[] = [
  Etapa.PRIMEIRO_CONTATO,
  Etapa.APRESENTACAO_ORCAMENTO,
  Etapa.FOLLOW_UP,
  Etapa.FORECAST,
  Etapa.FECHAMENTO,
];

/** Ordem de exibição (colunas do Kanban). */
export const TODAS_AS_ETAPAS: readonly Etapa[] = [...ORDEM_FUNIL, Etapa.PERDIDA];

export const ETAPAS_FINAIS: ReadonlySet<Etapa> = new Set([Etapa.FECHAMENTO, Etapa.PERDIDA]);

/** Etapas em que já existe proposta apresentada (e, portanto, validade que pode vencer). */
export const ETAPAS_COM_PROPOSTA: ReadonlySet<Etapa> = new Set([
  Etapa.APRESENTACAO_ORCAMENTO,
  Etapa.FOLLOW_UP,
  Etapa.FORECAST,
]);

export const ROTULOS: Record<Etapa, string> = {
  PRIMEIRO_CONTATO: 'Primeiro Contato',
  APRESENTACAO_ORCAMENTO: 'Apresentação de Orçamento',
  FOLLOW_UP: 'Follow-up',
  FORECAST: 'Forecast',
  FECHAMENTO: 'Fechamento',
  PERDIDA: 'Perdida',
};

export function ehEtapa(valor: unknown): valor is Etapa {
  return typeof valor === 'string' && (TODAS_AS_ETAPAS as readonly string[]).includes(valor);
}

export function ehFinal(etapa: Etapa): boolean {
  return ETAPAS_FINAIS.has(etapa);
}

/** Posição na ordem do funil; −1 para PERDIDA. */
export function indiceNoFunil(etapa: Etapa): number {
  return ORDEM_FUNIL.indexOf(etapa);
}

/** Etapa seguinte na ordem do funil, ou `null` em FECHAMENTO e PERDIDA. */
export function proximaEtapa(etapa: Etapa): Etapa | null {
  const i = indiceNoFunil(etapa);
  if (i < 0) return null;
  return ORDEM_FUNIL[i + 1] ?? null;
}
