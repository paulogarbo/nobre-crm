import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client';
import { registrarTratamentoDeErros } from '../src/plugins/error-handler';

/** Testa o plugin isolado: erros que, na API real, só aparecem em corrida com o banco. */
async function appQueLanca(erro: unknown) {
  const app = Fastify({ logger: false, bodyLimit: 64 });
  registrarTratamentoDeErros(app);
  app.get('/falha', async () => {
    throw erro;
  });
  app.post('/eco', async (req) => req.body);
  await app.ready();
  return app;
}

const erroPrisma = (code: string) => new Prisma.PrismaClientKnownRequestError('detalhe interno', { code, clientVersion: 'teste' });

describe('tratamento de erros', () => {
  it('P2025 (registro sumiu) → 404 e P2003 (referência inválida) → 409, sem detalhe interno', async () => {
    for (const [code, status, codigo] of [
      ['P2025', 404, 'REGISTRO_NAO_ENCONTRADO'],
      ['P2003', 409, 'REFERENCIA_INVALIDA'],
    ] as const) {
      const app = await appQueLanca(erroPrisma(code));
      const res = await app.inject({ method: 'GET', url: '/falha' });
      expect(res.statusCode).toBe(status);
      expect(res.json()).toMatchObject({ code: codigo });
      expect(res.body).not.toContain('detalhe interno');
      await app.close();
    }
  });

  it('outro erro do Prisma continua 500 genérico', async () => {
    const app = await appQueLanca(erroPrisma('P2034'));
    const res = await app.inject({ method: 'GET', url: '/falha' });
    expect(res.statusCode).toBe(500);
    expect(res.json().code).toBe('ERRO_INTERNO');
    await app.close();
  });

  it('erros 4xx do Fastify saem em português', async () => {
    const app = await appQueLanca(null);
    const json = { 'content-type': 'application/json' };
    const casos = [
      { headers: json, payload: '{"a":', status: 400, mensagem: 'O corpo da requisição não é um JSON válido.' },
      { headers: json, payload: '', status: 400, mensagem: /está vazio/ },
      { headers: json, payload: JSON.stringify({ texto: 'x'.repeat(100) }), status: 413, mensagem: /grande demais/ },
      { headers: { 'content-type': 'application/xml' }, payload: '<a/>', status: 415, mensagem: /não suportado/ },
    ];
    for (const c of casos) {
      const res = await app.inject({ method: 'POST', url: '/eco', headers: c.headers, payload: c.payload });
      expect(res.statusCode, c.payload).toBe(c.status);
      expect(res.json().message).toMatch(c.mensagem);
    }
    await app.close();
  });
});
