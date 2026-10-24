import { Etapa } from '@nobre/domain';
import { z } from 'zod';
import { dataCivil, followUpDaOportunidade, oportunidadeDetalhe } from '../oportunidades/oportunidades.schemas';

export const STATUS = ['ABERTO', 'CONCLUIDO', 'RESOLVIDO', 'SUBSTITUIDO'] as const;
export type StatusFollowUp = (typeof STATUS)[number];

export const queryListar = z.object({
  vendedorId: z.uuid('vendedorId inválido').optional(),
  status: z.enum(STATUS).default('ABERTO'),
  ate: dataCivil.optional(),
});

export const corpoConcluir = z
  .strictObject({
    registrarContato: z.boolean().default(true),
    observacao: z.string().trim().min(1).max(2000).optional(),
  })
  .nullish(); // sem corpo, o Fastify entrega `null`

export const paramsId = z.object({ id: z.string().trim().min(1).max(100) });

export const followUpSaida = followUpDaOportunidade.extend({
  oportunidade: z.object({
    id: z.string(),
    codigo: z.string(),
    empresa: z.string(),
    etapa: z.enum(Etapa),
    etapaRotulo: z.string(),
    valorEstimado: z.number().nullable(),
    vendedor: z.object({ id: z.string(), nome: z.string() }),
  }),
  atrasado: z.boolean(),
});
export type FollowUpDTO = z.infer<typeof followUpSaida>;

export const respostaListar = z.object({ hoje: z.string(), total: z.number(), itens: z.array(followUpSaida) });

export const respostaConcluir = z.object({ followUp: followUpSaida, oportunidade: oportunidadeDetalhe });

export const respostaRecalcular = z.object({
  hoje: z.string(),
  criados: z.number(),
  resolvidos: z.number(),
  substituidos: z.number(),
  mantidos: z.number(),
});
