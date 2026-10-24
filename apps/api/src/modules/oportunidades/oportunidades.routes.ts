import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { vendedorDaRequisicao, type Identidade } from '../../plugins/identidade';
import type { TransicoesService } from '../transicoes/transicoes.service';
import {
  corpoContato,
  corpoCriar,
  corpoEditar,
  corpoTransicao,
  oportunidadeDetalhe,
  paramsId,
  queryListarOportunidades,
  respostaHistorico,
  respostaListagem,
} from '@nobre/contracts';
import type { OportunidadesService } from './oportunidades.service';

interface Deps {
  identidade: Identidade;
  oportunidades: OportunidadesService;
  transicoes: TransicoesService;
}

export async function rotasOportunidades(app: FastifyInstance, { identidade, oportunidades, transicoes }: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/oportunidades', { schema: { querystring: queryListarOportunidades, response: { 200: respostaListagem } } }, (req) =>
    oportunidades.listar(req.query),
  );

  r.get('/oportunidades/:id', { schema: { params: paramsId, response: { 200: oportunidadeDetalhe } } }, (req) =>
    oportunidades.detalhe(req.params.id),
  );

  r.get(
    '/oportunidades/:id/historico',
    { schema: { params: paramsId, response: { 200: respostaHistorico } } },
    (req) => oportunidades.historico(req.params.id),
  );

  r.post(
    '/oportunidades',
    {
      preValidation: identidade.obrigatoria,
      schema: { body: corpoCriar, response: { 201: oportunidadeDetalhe } },
    },
    async (req, reply) => {
      const criada = await oportunidades.criar(req.body, vendedorDaRequisicao(req));
      return reply.status(201).send(criada);
    },
  );

  r.patch(
    '/oportunidades/:id',
    {
      preValidation: identidade.obrigatoria,
      schema: { params: paramsId, body: corpoEditar, response: { 200: oportunidadeDetalhe } },
    },
    (req) => oportunidades.editar(req.params.id, req.body, vendedorDaRequisicao(req)),
  );

  r.post(
    '/oportunidades/:id/contatos',
    {
      preValidation: identidade.obrigatoria,
      schema: { params: paramsId, body: corpoContato, response: { 200: oportunidadeDetalhe } },
    },
    (req) => oportunidades.registrarContato(req.params.id, req.body ?? undefined),
  );

  r.post(
    '/oportunidades/:id/transicoes',
    {
      preValidation: identidade.obrigatoria,
      schema: { params: paramsId, body: corpoTransicao, response: { 200: oportunidadeDetalhe } },
    },
    async (req) => {
      const id = await transicoes.transicionar(req.params.id, req.body.para, req.body.motivo, vendedorDaRequisicao(req));
      return oportunidades.detalhe(id);
    },
  );
}
