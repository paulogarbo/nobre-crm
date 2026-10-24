import { z } from 'zod';
import { etapa } from './comum';
import { transicaoPermitidaSaida } from './oportunidades';

export const respostaHealth = z.object({
  status: z.literal('ok'),
  hoje: z.string(),
  referenciaFixa: z.boolean(),
  versao: z.string(),
});

export const respostaEtapas = z.object({
  hoje: z.string(),
  referenciaFixa: z.boolean(),
  etapas: z.array(
    z.object({
      valor: etapa,
      rotulo: z.string(),
      ordem: z.number().nullable(),
      final: z.boolean(),
      transicoes: z.array(transicaoPermitidaSaida),
    }),
  ),
});
export type EtapasRespostaDTO = z.infer<typeof respostaEtapas>;
export type EtapaMetaDTO = EtapasRespostaDTO['etapas'][number];

export const respostaVendedores = z.array(z.object({ id: z.string(), nome: z.string(), email: z.string() }));
export type VendedorDTO = z.infer<typeof respostaVendedores>[number];
