import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors, ResponseSerializationError } from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors';

export interface CorpoErro {
  code: string;
  message: string;
  details?: unknown;
}

const LOCAIS: Record<string, string> = { body: 'corpo', querystring: 'query', params: 'parâmetro', headers: 'header' };

/**
 * Todas as respostas de erro seguem `{ code, message, details? }`. Nada de stack ou mensagem interna
 * (Prisma, driver) chega ao cliente: em 500 o detalhe fica só no log, correlacionado por `x-request-id`.
 */
export function registrarTratamentoDeErros(app: FastifyInstance) {
  app.setErrorHandler<FastifyError | AppError>((erro, request, reply) => {
    if (erro instanceof AppError) {
      const corpo: CorpoErro = { code: erro.code, message: erro.message };
      if (erro.details !== undefined) corpo.details = erro.details;
      return reply.status(erro.statusCode).send(corpo);
    }

    if (hasZodFastifySchemaValidationErrors(erro)) {
      const local = erro.validationContext ?? 'body';
      const issues = erro.validation.map((v) => ({
        local,
        campo: v.instancePath.replace(/^\//, '').replace(/\//g, '.'),
        mensagem: v.message ?? 'valor inválido',
      }));
      const primeira = issues[0];
      const resumo = primeira
        ? `${primeira.campo ? `${primeira.campo}: ` : ''}${primeira.mensagem}`
        : 'Dados inválidos.';
      return reply.status(400).send({
        code: 'VALIDACAO',
        message: `Dados inválidos (${LOCAIS[local] ?? local}). ${resumo}`,
        details: { issues },
      } satisfies CorpoErro);
    }

    if (erro instanceof ResponseSerializationError) {
      request.log.error({ err: erro, issues: erro.cause.issues }, 'resposta fora do schema');
      return reply.status(500).send({ code: 'ERRO_INTERNO', message: 'Erro interno. Tente novamente.' });
    }

    const status = erro.statusCode ?? 500;
    if (status === 429) {
      return reply.status(429).send({
        code: 'MUITAS_REQUISICOES',
        message: 'Muitas requisições em pouco tempo. Aguarde um instante e tente de novo.',
      } satisfies CorpoErro);
    }
    if (status >= 400 && status < 500) {
      // Erros do próprio Fastify (JSON malformado, content-type, payload grande demais...).
      return reply.status(status).send({
        code: status === 400 ? 'VALIDACAO' : 'REQUISICAO_INVALIDA',
        message: erro.message,
      } satisfies CorpoErro);
    }

    request.log.error({ err: erro }, 'erro inesperado');
    return reply.status(500).send({
      code: 'ERRO_INTERNO',
      message: 'Erro interno. Tente novamente; se persistir, informe o x-request-id ao suporte.',
    } satisfies CorpoErro);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      code: 'ROTA_NAO_ENCONTRADA',
      message: `Rota ${request.method} ${request.url} não existe.`,
    } satisfies CorpoErro);
  });
}
