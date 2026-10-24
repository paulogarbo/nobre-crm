import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors, ResponseSerializationError } from 'fastify-type-provider-zod';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';

export interface CorpoErro {
  code: string;
  message: string;
  details?: unknown;
}

const LOCAIS: Record<string, string> = { body: 'corpo', querystring: 'query', params: 'parâmetro', headers: 'header' };

/** Erros 4xx do próprio Fastify (parse do corpo) com mensagem em português. */
const MENSAGENS_FASTIFY: Record<string, string> = {
  FST_ERR_CTP_INVALID_JSON_BODY: 'O corpo da requisição não é um JSON válido.',
  FST_ERR_CTP_EMPTY_JSON_BODY: 'O corpo da requisição está vazio, mas o content-type é application/json.',
  FST_ERR_CTP_BODY_TOO_LARGE: 'O corpo da requisição é grande demais.',
  FST_ERR_CTP_INVALID_MEDIA_TYPE: 'Tipo de conteúdo não suportado: envie application/json.',
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: 'O tamanho do corpo não confere com o header Content-Length.',
};

/**
 * Erros do Prisma que chegam aqui por corrida (o registro sumiu ou a referência deixou de existir
 * entre a leitura e a escrita). Os demais seguem como 500.
 */
const ERROS_PRISMA: Record<string, CorpoErro & { status: number }> = {
  P2025: {
    status: 404,
    code: 'REGISTRO_NAO_ENCONTRADO',
    message: 'O registro não existe mais (pode ter sido removido por outra pessoa). Recarregue e tente novamente.',
  },
  P2003: {
    status: 409,
    code: 'REFERENCIA_INVALIDA',
    message: 'Um registro relacionado não existe ou foi removido. Recarregue e tente novamente.',
  },
};

function erroPrismaConhecido(erro: unknown) {
  return erro instanceof Prisma.PrismaClientKnownRequestError ? ERROS_PRISMA[erro.code] : undefined;
}

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

    const prisma = erroPrismaConhecido(erro);
    if (prisma) {
      const { status, ...corpo } = prisma;
      request.log.warn({ err: erro }, 'conflito com o banco');
      return reply.status(status).send(corpo satisfies CorpoErro);
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
        message: (erro.code && MENSAGENS_FASTIFY[erro.code]) || 'Requisição inválida.',
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
