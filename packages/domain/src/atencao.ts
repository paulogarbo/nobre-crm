import { diasEntre, formatarDataBR, pluralDias, type DataCivil } from './datas';
import { ETAPAS_COM_PROPOSTA, Etapa, ehFinal } from './etapas';
import { listarCampos } from './erros';
import { camposFaltantesParaApresentar } from './maquina-de-estados';
import type { OportunidadeDominio } from './tipos';

export enum TipoSinal {
  EVENTO_PASSOU = 'EVENTO_PASSOU',
  EVENTO_PROXIMO = 'EVENTO_PROXIMO',
  PROPOSTA_VENCIDA = 'PROPOSTA_VENCIDA',
  PROPOSTA_VENCE_EM_BREVE = 'PROPOSTA_VENCE_EM_BREVE',
  SEM_CONTATO = 'SEM_CONTATO',
  DADOS_INCOMPLETOS = 'DADOS_INCOMPLETOS',
}

export type Severidade = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';

/** Da mais grave para a menos grave. */
export const SEVERIDADES: readonly Severidade[] = ['CRITICA', 'ALTA', 'MEDIA', 'BAIXA'];

export interface Sinal {
  tipo: TipoSinal;
  severidade: Severidade;
  peso: number;
  mensagem: string;
  dados?: Record<string, unknown>;
}

/** Limiares em dias. Constantes nomeadas para poderem virar configuração do gestor numa versão futura. */
export const LIMIARES = {
  /** Evento do cliente em até N dias → crítico. */
  EVENTO_CRITICO_DIAS: 3,
  /** Evento do cliente em até N dias → alto. */
  EVENTO_ALERTA_DIAS: 7,
  /** Proposta vence em até N dias → médio. */
  PROPOSTA_VENCENDO_DIAS: 3,
  /** Lead em Primeiro Contato sem contato há N dias ou mais → SLA estourado. */
  LEAD_SEM_CONTATO_DIAS: 2,
  /** Negociação (demais etapas) sem contato há N dias ou mais. */
  SEM_CONTATO_DIAS: 8,
} as const;

export const PESOS = {
  EVENTO_PASSOU: 120,
  EVENTO_CRITICO: 100,
  EVENTO_ALERTA: 60,
  PROPOSTA_VENCIDA: 50,
  PROPOSTA_VENCE_EM_BREVE: 30,
  LEAD_SEM_CONTATO: 45,
  SEM_CONTATO: 40,
  DADOS_INCOMPLETOS: 10,
} as const;

/** Bônus por valor: R$ 2.000 = 1 ponto, limitado a 20. Desempata a favor de negociações maiores. */
export const BONUS_VALOR = { REAIS_POR_PONTO: 2000, MAXIMO: 20 } as const;

function sinalDeEvento(evento: DataCivil, hoje: DataCivil): Sinal | null {
  const dias = diasEntre(hoje, evento);
  const data = formatarDataBR(evento);
  if (dias < 0) {
    return {
      tipo: TipoSinal.EVENTO_PASSOU,
      severidade: 'CRITICA',
      peso: PESOS.EVENTO_PASSOU,
      mensagem: `Evento do cliente foi em ${data} e a venda não fechou.`,
      dados: { eventoCliente: evento, dias },
    };
  }
  if (dias <= LIMIARES.EVENTO_ALERTA_DIAS) {
    const critico = dias <= LIMIARES.EVENTO_CRITICO_DIAS;
    return {
      tipo: TipoSinal.EVENTO_PROXIMO,
      severidade: critico ? 'CRITICA' : 'ALTA',
      peso: critico ? PESOS.EVENTO_CRITICO : PESOS.EVENTO_ALERTA,
      mensagem: `Evento do cliente em ${dias} dia(s) (${data}).`,
      dados: { eventoCliente: evento, dias },
    };
  }
  return null;
}

function sinalDeProposta(validade: DataCivil, hoje: DataCivil): Sinal | null {
  const dias = diasEntre(hoje, validade);
  if (dias < 0) {
    return {
      tipo: TipoSinal.PROPOSTA_VENCIDA,
      severidade: 'ALTA',
      peso: PESOS.PROPOSTA_VENCIDA,
      mensagem: `Proposta vencida em ${formatarDataBR(validade)}.`,
      dados: { validadeProposta: validade, dias },
    };
  }
  if (dias <= LIMIARES.PROPOSTA_VENCENDO_DIAS) {
    return {
      tipo: TipoSinal.PROPOSTA_VENCE_EM_BREVE,
      severidade: 'MEDIA',
      peso: PESOS.PROPOSTA_VENCE_EM_BREVE,
      mensagem: `Proposta vence em ${dias} dia(s).`,
      dados: { validadeProposta: validade, dias },
    };
  }
  return null;
}

function sinalDeContato(op: OportunidadeDominio, hoje: DataCivil): Sinal | null {
  const ehLead = op.etapa === Etapa.PRIMEIRO_CONTATO;
  const limiar = ehLead ? LIMIARES.LEAD_SEM_CONTATO_DIAS : LIMIARES.SEM_CONTATO_DIAS;
  const peso = ehLead ? PESOS.LEAD_SEM_CONTATO : PESOS.SEM_CONTATO;

  let dias: number | null;
  if (op.ultimoContato !== null) {
    dias = diasEntre(op.ultimoContato, hoje);
    if (dias < limiar) return null;
  } else {
    // Nunca houve contato: sempre é sinal. "Há N dias" conta desde a criação, quando conhecida.
    dias = op.criadaEm ? diasEntre(op.criadaEm, hoje) : null;
  }

  let mensagem: string;
  if (dias === null) mensagem = ehLead ? 'Lead sem primeiro contato: nenhum contato registrado (SLA).' : 'Nenhum contato registrado.';
  else mensagem = ehLead ? `Lead sem primeiro contato há ${pluralDias(dias)} (SLA).` : `Sem contato há ${pluralDias(dias)}.`;

  return {
    tipo: TipoSinal.SEM_CONTATO,
    severidade: 'ALTA',
    peso,
    mensagem,
    dados: { ultimoContato: op.ultimoContato, dias },
  };
}

/** Sinais de atenção da oportunidade em `hoje`, do mais pesado para o mais leve. Finais → `[]`. */
export function calcularSinais(op: OportunidadeDominio, hoje: DataCivil): Sinal[] {
  if (ehFinal(op.etapa)) return [];
  const sinais: Sinal[] = [];

  if (op.eventoCliente !== null) {
    const s = sinalDeEvento(op.eventoCliente, hoje);
    if (s) sinais.push(s);
  }
  if (ETAPAS_COM_PROPOSTA.has(op.etapa) && op.validadeProposta !== null) {
    const s = sinalDeProposta(op.validadeProposta, hoje);
    if (s) sinais.push(s);
  }
  const contato = sinalDeContato(op, hoje);
  if (contato) sinais.push(contato);

  if (op.etapa === Etapa.PRIMEIRO_CONTATO) {
    const faltando = camposFaltantesParaApresentar(op);
    if (faltando.length > 0) {
      sinais.push({
        tipo: TipoSinal.DADOS_INCOMPLETOS,
        severidade: 'BAIXA',
        peso: PESOS.DADOS_INCOMPLETOS,
        mensagem: `Faltam dados para apresentar orçamento: ${listarCampos(faltando)}.`,
        dados: { faltando },
      });
    }
  }

  return sinais.sort((a, b) => b.peso - a.peso);
}

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Soma dos pesos + bônus por valor. Sem sinais → 0 (valor alto sozinho não pede atenção). */
export function calcularScore(op: OportunidadeDominio, sinais: Sinal[]): number {
  if (sinais.length === 0) return 0;
  const base = sinais.reduce((total, s) => total + s.peso, 0);
  const bonusValor = Math.min(BONUS_VALOR.MAXIMO, (op.valorEstimado ?? 0) / BONUS_VALOR.REAIS_POR_PONTO);
  return arredondar2(base + bonusValor);
}

export function compararSeveridade(a: Severidade, b: Severidade): number {
  return SEVERIDADES.indexOf(a) - SEVERIDADES.indexOf(b);
}

/** A severidade mais alta entre os sinais; `null` se não há sinais. */
export function severidadeGeral(sinais: Sinal[]): Severidade | null {
  let maior: Severidade | null = null;
  for (const s of sinais) {
    if (maior === null || compararSeveridade(s.severidade, maior) < 0) maior = s.severidade;
  }
  return maior;
}

/** `true` se `severidade` é igual ou mais grave que `minima` (filtro `severidade=` da listagem). */
export function atingeSeveridade(severidade: Severidade | null, minima: Severidade): boolean {
  return severidade !== null && compararSeveridade(severidade, minima) <= 0;
}

export interface Atencao {
  severidade: Severidade | null;
  score: number;
  sinais: Sinal[];
}

export function avaliarAtencao(op: OportunidadeDominio, hoje: DataCivil): Atencao {
  const sinais = calcularSinais(op, hoje);
  return { severidade: severidadeGeral(sinais), score: calcularScore(op, sinais), sinais };
}

export interface ItemPriorizavel {
  codigo: string;
  etapa: Etapa;
  valorEstimado: number | null;
  score: number;
}

/**
 * Ordenação padrão: `score desc`, `valorEstimado desc`, `codigo asc`.
 * Oportunidades finais vão para o fim (por código): não há trabalho a fazer nelas.
 */
export function compararPrioridade(a: ItemPriorizavel, b: ItemPriorizavel): number {
  const finalA = ehFinal(a.etapa);
  const finalB = ehFinal(b.etapa);
  if (finalA !== finalB) return finalA ? 1 : -1;
  if (finalA && finalB) return compararCodigo(a.codigo, b.codigo);
  if (b.score !== a.score) return b.score - a.score;
  const valorA = a.valorEstimado ?? 0;
  const valorB = b.valorEstimado ?? 0;
  if (valorB !== valorA) return valorB - valorA;
  return compararCodigo(a.codigo, b.codigo);
}

/** Compara códigos numericamente (OPP-999 antes de OPP-1000). */
export function compararCodigo(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { numeric: true });
}
