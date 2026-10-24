import type { FastifyInstance, FastifyRequest, preValidationAsyncHookHandler } from 'fastify';
import type { PrismaClient } from '../lib/prisma';
import { AppError } from '../lib/errors';

const HEADER = 'x-vendedor-id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * STAND-IN DE AUTENTICAÇÃO. O header `x-vendedor-id` identifica quem está agindo, mas não autentica
 * ninguém: qualquer cliente pode enviá-lo. Este é o único ponto que sabe de onde vem a identidade;
 * em produção ele passa a validar um JWT/OIDC e preencher `request.vendedor` do mesmo jeito, sem
 * mudar nenhuma rota.
 */
/**
 * Os ganchos rodam em `preValidation`: um cliente sem identidade recebe 401 antes de qualquer 400 de
 * validação, sem descobrir o formato esperado do corpo.
 */
export interface Identidade {
  /** Exige o header; 401 se ausente ou se o vendedor não existir. */
  obrigatoria: preValidationAsyncHookHandler;
  /** Carrega o vendedor se o header vier; 401 só se vier inválido. */
  opcional: preValidationAsyncHookHandler;
}

export function criarIdentidade(app: FastifyInstance, prisma: PrismaClient): Identidade {
  app.decorateRequest('vendedor', null);

  async function carregar(request: FastifyRequest, exigir: boolean) {
    const bruto = request.headers[HEADER];
    const valor = Array.isArray(bruto) ? bruto[0] : bruto;
    if (!valor || valor.trim() === '') {
      if (exigir) {
        throw new AppError(
          401,
          'IDENTIDADE_AUSENTE',
          `Informe o vendedor que está agindo no header ${HEADER}.`,
        );
      }
      return;
    }
    const id = valor.trim();
    const vendedor = UUID.test(id)
      ? await prisma.vendedor.findUnique({ where: { id }, select: { id: true, nome: true } })
      : null;
    if (!vendedor) {
      throw new AppError(401, 'IDENTIDADE_INVALIDA', `O header ${HEADER} não corresponde a nenhum vendedor.`);
    }
    request.vendedor = vendedor;
  }

  return {
    obrigatoria: async (request) => carregar(request, true),
    opcional: async (request) => carregar(request, false),
  };
}

/** Vendedor da requisição (só chamar em rotas com `identidade.obrigatoria`). */
export function vendedorDaRequisicao(request: FastifyRequest): { id: string; nome: string } {
  if (!request.vendedor) throw new AppError(401, 'IDENTIDADE_AUSENTE', `Informe o header ${HEADER}.`);
  return request.vendedor;
}
