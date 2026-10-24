import { parseDataCivil, type DataCivil } from '@nobre/domain';

/**
 * Conversão entre data civil ('YYYY-MM-DD') e o `Date` que o Prisma usa para colunas `@db.Date`.
 * O Prisma grava/lê essas colunas como meia-noite UTC, então a conversão é sempre em UTC.
 */
export function paraDataBanco(data: DataCivil): Date {
  const { ano, mes, dia } = parseDataCivil(data);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export function paraDataBancoOuNull(data: DataCivil | null | undefined): Date | null {
  return data ? paraDataBanco(data) : null;
}

export function deDataBanco(data: Date): DataCivil {
  const ano = String(data.getUTCFullYear()).padStart(4, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function deDataBancoOuNull(data: Date | null): DataCivil | null {
  return data ? deDataBanco(data) : null;
}
