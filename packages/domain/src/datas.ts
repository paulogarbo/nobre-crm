/**
 * Datas civis (sem hora, sem fuso) no formato 'YYYY-MM-DD'.
 *
 * Datas de negócio (último contato, validade, evento) não têm hora. Tratá-las como `Date`
 * com fuso implícito faz '2026-10-15' virar 14/10 à noite em UTC-3. Por isso todo cálculo
 * aqui usa Date.UTC explicitamente e nunca constrói um Date a partir de texto.
 */
export type DataCivil = string;

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_POR_DIA = 86_400_000;

export interface PartesData {
  ano: number;
  mes: number;
  dia: number;
}

/** Retorna as partes da data ou `null` se o texto não for uma data civil real (31/02 é inválido). */
export function lerDataCivil(texto: string): PartesData | null {
  const m = FORMATO.exec(texto);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) return null;
  const utc = new Date(Date.UTC(ano, mes - 1, dia));
  if (utc.getUTCFullYear() !== ano || utc.getUTCMonth() !== mes - 1 || utc.getUTCDate() !== dia) return null;
  return { ano, mes, dia };
}

export function ehDataCivilValida(texto: string): boolean {
  return lerDataCivil(texto) !== null;
}

/** Igual a `lerDataCivil`, mas lança erro para entrada inválida. */
export function parseDataCivil(texto: string): PartesData {
  const partes = lerDataCivil(texto);
  if (!partes) throw new RangeError(`Data civil inválida: "${texto}" (esperado YYYY-MM-DD)`);
  return partes;
}

function emDiasUtc(texto: DataCivil): number {
  const { ano, mes, dia } = parseDataCivil(texto);
  return Date.UTC(ano, mes - 1, dia) / MS_POR_DIA;
}

function deDiasUtc(dias: number): DataCivil {
  const d = new Date(dias * MS_POR_DIA);
  const ano = String(d.getUTCFullYear()).padStart(4, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Diferença `b − a` em dias inteiros. */
export function diasEntre(a: DataCivil, b: DataCivil): number {
  return emDiasUtc(b) - emDiasUtc(a);
}

export function ehAnterior(a: DataCivil, b: DataCivil): boolean {
  return diasEntre(a, b) > 0;
}

export function somarDias(a: DataCivil, n: number): DataCivil {
  return deDiasUtc(emDiasUtc(a) + n);
}

/** Data civil de um instante em um fuso (padrão: horário de Brasília). */
export function hojeDataCivil(instante: Date, timeZone = 'America/Sao_Paulo'): DataCivil {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/** 'YYYY-MM-DD' → 'dd/MM/yyyy' (exibição em mensagens do domínio). */
export function formatarDataBR(texto: DataCivil): string {
  const { ano, mes, dia } = parseDataCivil(texto);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

/** "1 dia", "3 dias". */
export function pluralDias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}
