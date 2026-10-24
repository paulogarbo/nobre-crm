import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { erros } from '../../lib/errors';
import { vendedorDaRequisicao, type Identidade } from '../../plugins/identidade';
import {
  corpoConcluir,
  paramsId,
  queryListar,
  respostaConcluir,
  respostaListar,
  respostaRecalcular,
} from './follow-ups.schemas';
import type { FollowUpsService } from './follow-ups.service';

export async function rotasFollowUps(
  app: FastifyInstance,
  { identidade, followUps }: { identidade: Identidade; followUps: FollowUpsService },
) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/follow-ups',
    { preValidation: identidade.opcional, schema: { querystring: queryListar, response: { 200: respostaListar } } },
    (req) => {
      const vendedorId = req.query.vendedorId ?? req.vendedor?.id;
      if (!vendedorId) {
        throw erros.validacao('Informe de quem são os follow-ups: query vendedorId ou header x-vendedor-id.', {
          issues: [{ local: 'querystring', campo: 'vendedorId', mensagem: 'obrigatório sem o header x-vendedor-id' }],
        });
      }
      return followUps.listar(vendedorId, req.query.status, req.query.ate);
    },
  );

  r.post(
    '/follow-ups/:id/concluir',
    {
      preValidation: identidade.obrigatoria,
      schema: { params: paramsId, body: corpoConcluir, response: { 200: respostaConcluir } },
    },
    (req) =>
      followUps.concluir(
        req.params.id,
        { registrarContato: req.body?.registrarContato ?? true, observacao: req.body?.observacao },
        vendedorDaRequisicao(req),
      ),
  );

  r.post(
    '/follow-ups/recalcular',
    { preValidation: identidade.obrigatoria, schema: { response: { 200: respostaRecalcular } } },
    async () => {
      const { novas: _novas, ...resultado } = await followUps.recalcularTodos();
      return resultado;
    },
  );
}
