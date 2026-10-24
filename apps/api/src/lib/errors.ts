import type { ResultadoTransicao } from '@nobre/domain';

/** Erro de aplicação com código estável. O error handler converte em `{ code, message, details? }`. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const erros = {
  validacao: (message: string, details?: unknown) => new AppError(400, 'VALIDACAO', message, details),
  oportunidadeNaoEncontrada: () =>
    new AppError(404, 'OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade não encontrada.'),
  followUpNaoEncontrado: () => new AppError(404, 'FOLLOW_UP_NAO_ENCONTRADO', 'Follow-up não encontrado.'),
  vendedorNaoEncontrado: () => new AppError(404, 'VENDEDOR_NAO_ENCONTRADO', 'Vendedor não encontrado.'),
  oportunidadeFinalizada: () =>
    new AppError(
      409,
      'OPORTUNIDADE_FINALIZADA',
      'Oportunidade finalizada (Fechamento ou Perdida): apenas as observações podem ser editadas.',
    ),
  followUpJaEncerrado: () =>
    new AppError(409, 'FOLLOW_UP_JA_ENCERRADO', 'Este follow-up já foi encerrado.'),
  oportunidadeAlterada: () =>
    new AppError(
      409,
      'OPORTUNIDADE_ALTERADA',
      'A oportunidade foi alterada por outra pessoa ao mesmo tempo. Recarregue e tente novamente.',
    ),
  codigoDuplicado: () =>
    new AppError(409, 'CODIGO_DUPLICADO', 'Não foi possível gerar um código único. Tente novamente.'),
};

/** Converte a falha do domínio em 422 com o mesmo código e mensagem. */
export function erroDeDominio(resultado: Extract<ResultadoTransicao, { ok: false }>): AppError {
  return new AppError(422, resultado.code, resultado.message, resultado.details);
}
