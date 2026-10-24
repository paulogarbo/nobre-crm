import { getVendedorId } from '../identidade';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(/\/$/, '');

/** Erro no formato padrão da API: `{ code, message, details? }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface OpcoesApi extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Envia o header de identidade. Padrão: só nas escritas. */
  comIdentidade?: boolean;
}

function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

export async function api<T>(caminho: string, opcoes: OpcoesApi = {}): Promise<T> {
  const { body, comIdentidade, headers, ...init } = opcoes;
  const metodo = (init.method ?? 'GET').toUpperCase();
  const h = new Headers(headers);
  if (body !== undefined) h.set('content-type', 'application/json');
  const vendedorId = getVendedorId();
  if ((comIdentidade ?? metodo !== 'GET') && vendedorId) h.set('x-vendedor-id', vendedorId);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${caminho}`, {
      ...init,
      method: metodo,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (erro) {
    throw new ApiError(0, 'SEM_CONEXAO', `Não foi possível conectar à API em ${API_URL}.`, String(erro));
  }

  const texto = await res.text();
  const json = texto ? lerJson(texto) : undefined;
  if (!res.ok) {
    const e = (json ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new ApiError(res.status, e.code ?? 'ERRO_HTTP', e.message ?? `Erro ${res.status} na API.`, e.details);
  }
  return json as T;
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  return 'Erro inesperado.';
}
