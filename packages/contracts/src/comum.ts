import { Etapa, PRIORIDADES, SEVERIDADES, ehDataCivilValida } from '@nobre/domain';
import { z } from 'zod';

/** Data civil `YYYY-MM-DD` que existe no calendário (31/02 é recusado). */
export const dataCivil = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato YYYY-MM-DD')
  .refine(ehDataCivilValida, 'data inexistente');

/** Campos de texto opcionais: string vazia vira `null` ("não informado"). */
export const vazioParaNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const paramsId = z.object({ id: z.string().trim().min(1).max(100) });

export const etapa = z.enum(Etapa);
export const severidade = z.enum(SEVERIDADES);
export const prioridade = z.enum(PRIORIDADES);

export const STATUS_FOLLOW_UP = ['ABERTO', 'CONCLUIDO', 'RESOLVIDO', 'SUBSTITUIDO'] as const;
export const statusFollowUp = z.enum(STATUS_FOLLOW_UP);
export type StatusFollowUp = z.infer<typeof statusFollowUp>;

export const vendedorRef = z.object({ id: z.string(), nome: z.string() });
export type VendedorRef = z.infer<typeof vendedorRef>;
