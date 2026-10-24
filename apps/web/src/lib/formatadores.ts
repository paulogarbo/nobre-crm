import { diasEntre, formatarDataBR, type DataCivil } from '@nobre/domain';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 7.200" (sem centavos quando inteiro). */
export function moeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return Number.isInteger(valor) ? brl.format(valor) : brlCentavos.format(valor);
}

/** "R$ 45,8 mil", "R$ 1,2 mi". */
export function moedaCompacta(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return brl.format(valor);
}

/** 'YYYY-MM-DD' → 'dd/MM/yyyy'. */
export function data(d: DataCivil | null | undefined): string {
  return d ? formatarDataBR(d) : '—';
}

/** Timestamp ISO → "15/10/2026 10:00" no fuso do navegador. */
export function dataHora(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/** Dias desde o contato → "hoje", "ontem", "há N dias". */
export function haDias(dias: number | null): string {
  if (dias === null) return 'sem contato';
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

/** Distância até uma data futura/passada em relação a hoje: "em 3 dias", "hoje", "há 2 dias". */
export function relativo(d: DataCivil, hoje: DataCivil): string {
  const n = diasEntre(hoje, d);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}

export function quantidade(n: number): string {
  return `${n.toLocaleString('pt-BR')} un`;
}
