import { respostaEtapas } from '@nobre/contracts';
import { ROTULOS, TODAS_AS_ETAPAS, ehFinal, indiceNoFunil, transicoesEstruturais } from '@nobre/domain';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Relogio } from '../../lib/clock';

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
