import { ROTULOS, TODAS_AS_ETAPAS, ehFinal, indiceNoFunil, transicoesEstruturais, Etapa } from '@nobre/domain';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Relogio } from '../../lib/clock';
import { transicaoPermitidaSaida } from '../oportunidades/oportunidades.schemas';

const respostaEtapas = z.object({
  hoje: z.string(),
  referenciaFixa: z.boolean(),
  etapas: z.array(
    z.object({
      valor: z.enum(Etapa),
      rotulo: z.string(),
      ordem: z.number().nullable(),
      final: z.boolean(),
      transicoes: z.array(transicaoPermitidaSaida),
    }),
  ),
});

/** Metadados do funil. As transições aqui são estruturais; as de cada oportunidade já aplicam os dados. */
export async function rotasEtapas(app: FastifyInstance, { relogio }: { relogio: Relogio }) {
  app.withTypeProvider<ZodTypeProvider>().get('/etapas', { schema: { response: { 200: respostaEtapas } } }, () => ({
    hoje: relogio.hoje(),
    referenciaFixa: relogio.referenciaFixa,
    etapas: TODAS_AS_ETAPAS.map((etapa) => {
      const ordem = indiceNoFunil(etapa);
      return {
        valor: etapa,
        rotulo: ROTULOS[etapa],
        ordem: ordem >= 0 ? ordem : null,
        final: ehFinal(etapa),
        transicoes: transicoesEstruturais(etapa),
      };
    }),
  }));
}
