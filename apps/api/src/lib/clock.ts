import { hojeDataCivil, type DataCivil } from '@nobre/domain';

export interface Relogio {
  /** "Hoje" de todos os cálculos de domínio: REFERENCE_DATE, se definida; senão a data atual em Brasília. */
  hoje(): DataCivil;
  /** `true` quando REFERENCE_DATE está definida. */
  readonly referenciaFixa: boolean;
  /** Instante atual (timestamps técnicos: createdAt, encerradoEm). */
  agora(): Date;
}

export function criarRelogio(referenceDate?: DataCivil): Relogio {
  return {
    hoje: () => referenceDate ?? hojeDataCivil(new Date()),
    referenciaFixa: referenceDate !== undefined,
    agora: () => new Date(),
  };
}
