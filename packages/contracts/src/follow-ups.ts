import { z } from 'zod';
import { STATUS_FOLLOW_UP, dataCivil, etapa, vendedorRef } from './comum';
import { followUpDaOportunidade, oportunidadeDetalhe } from './oportunidades';

// ---------- entrada ----------

export const queryListarFollowUps = z.object({
  vendedorId: z.uuid('vendedorId inválido').optional(),
  status: z.enum(STATUS_FOLLOW_UP).default('ABERTO'),
  ate: dataCivil.optional(),
});

export const corpoConcluir = z
  .strictObject({
    registrarContato: z.boolean().default(true),
    observacao: z.string().trim().min(1).max(2000).optional(),
  })
  .nullish(); // sem corpo, o Fastify entrega `null`

// ---------- saída ----------

export const followUpSaida = followUpDaOportunidade.extend({
  oportunidade: z.object({
    id: z.string(),
    codigo: z.string(),
    empresa: z.string(),
    etapa,
    etapaRotulo: z.string(),
    valorEstimado: z.number().nullable(),
    vendedor: vendedorRef,
  }),
  atrasado: z.boolean(),
});
export type FollowUpDTO = z.infer<typeof followUpSaida>;

export const respostaListarFollowUps = z.object({ hoje: z.string(), total: z.number(), itens: z.array(followUpSaida) });
export type FollowUpsRespostaDTO = z.infer<typeof respostaListarFollowUps>;

export const respostaConcluir = z.object({ followUp: followUpSaida, oportunidade: oportunidadeDetalhe });

export const respostaRecalcular = z.object({
  hoje: z.string(),
  criados: z.number(),
  resolvidos: z.number(),
  substituidos: z.number(),
  mantidos: z.number(),
});
export type ResultadoRecalculoDTO = z.infer<typeof respostaRecalcular>;
