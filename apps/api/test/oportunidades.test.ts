import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chamar, criarContexto, resetarComSeed, zerarBanco, type Contexto, type Vendedores } from './helpers';

let ctx: Contexto;
let v: Vendedores;

beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.fechar();
});
beforeEach(async () => {
  v = await resetarComSeed(ctx.prisma);
});

const codigos = (res: { body: { itens: Array<{ codigo: string }> } }) => res.body.itens.map((i) => i.codigo);
const get = (url: string) => chamar(ctx.app, 'GET', url);
const transicionar = (codigo: string, vendedorId: string, body: unknown) =>
  chamar(ctx.app, 'POST', `/oportunidades/${codigo}/transicoes`, { vendedorId, body });

const transicionarSemIdentidade = (body: unknown) =>
  chamar(ctx.app, 'POST', '/oportunidades/OPP-2003/transicoes', { body });

async function contarHistorico(codigo: string) {
  return ctx.prisma.transicaoEtapa.count({ where: { oportunidade: { codigo } } });
}

/** Prova que uma requisição recusada não alterou nada: mesma etapa e nenhuma linha nova no histórico. */
async function esperarInalterada(codigo: string, etapa: string, nHistorico: number) {
  const op = await ctx.prisma.oportunidade.findUniqueOrThrow({ where: { codigo } });
  expect(op.etapa, `etapa de ${codigo}`).toBe(etapa);
  expect(await contarHistorico(codigo), `histórico de ${codigo}`).toBe(nHistorico);
}

describe('metadados', () => {
  it('I-01 GET /health usa a data de referência', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', hoje: '2026-10-15', referenciaFixa: true, versao: '1.0.0' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('I-02 GET /etapas devolve as 6 etapas com as transições estruturais', async () => {
    const res = await get('/etapas');
    expect(res.status).toBe(200);
    expect(res.body.hoje).toBe('2026-10-15');
    const resumo = res.body.etapas.map(
      (e: any) => `${e.valor}|${e.ordem}|${e.final}|${e.transicoes.map((t: any) => t.para).join(',')}`,
    );
    expect(resumo).toEqual([
      'PRIMEIRO_CONTATO|0|false|APRESENTACAO_ORCAMENTO,PERDIDA',
      'APRESENTACAO_ORCAMENTO|1|false|FOLLOW_UP,PERDIDA',
      'FOLLOW_UP|2|false|FORECAST,APRESENTACAO_ORCAMENTO,PERDIDA',
      'FORECAST|3|false|FECHAMENTO,FOLLOW_UP,APRESENTACAO_ORCAMENTO,PERDIDA',
      'FECHAMENTO|4|true|',
      'PERDIDA|null|true|',
    ]);
    expect(res.body.etapas[1].rotulo).toBe('Apresentação de Orçamento');
  });

  it('I-03 GET /vendedores devolve 3, por nome', async () => {
    const res = await get('/vendedores');
    expect(res.status).toBe(200);
    expect(res.body.map((x: any) => x.nome)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(Object.keys(res.body[0]).sort()).toEqual(['email', 'id', 'nome']);
  });
});

describe('listagem e busca', () => {
  it('I-04 seed + GET /oportunidades: 7 itens na ordem de prioridade', async () => {
    const res = await get('/oportunidades');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(7);
    expect(res.body.hoje).toBe('2026-10-15');
    expect(codigos(res)).toEqual(['OPP-2003', 'OPP-2002', 'OPP-2004', 'OPP-2001', 'OPP-2005', 'OPP-2006', 'OPP-2007']);
    const porCodigo = Object.fromEntries(res.body.itens.map((i: any) => [i.codigo, i]));
    expect(porCodigo['OPP-2003'].atencao).toEqual({
      severidade: 'CRITICA',
      score: 103.6,
      sinais: [{ tipo: 'EVENTO_PROXIMO', severidade: 'CRITICA', mensagem: 'Evento do cliente em 3 dia(s) (18/10/2026).' }],
    });
    expect(porCodigo['OPP-2002'].atencao).toMatchObject({ severidade: 'ALTA', score: 94.9 });
    expect(porCodigo['OPP-2004'].atencao).toMatchObject({ severidade: 'ALTA', score: 91.95 });
    expect(porCodigo['OPP-2001'].atencao).toMatchObject({ severidade: 'BAIXA', score: 12.25 });
    for (const c of ['OPP-2005', 'OPP-2006', 'OPP-2007']) {
      expect(porCodigo[c].atencao).toEqual({ severidade: null, score: 0, sinais: [] });
    }
    expect(porCodigo['OPP-2002']).toMatchObject({
      etapa: 'APRESENTACAO_ORCAMENTO',
      etapaRotulo: 'Apresentação de Orçamento',
      vendedor: { nome: 'Bruno' },
      valorEstimado: 9800,
      ultimoContato: '2026-10-06',
      validadeProposta: '2026-10-13',
      eventoCliente: '2026-10-25',
      diasSemContato: 9,
      itens: [{ descricao: 'Kit escritório', quantidade: 120, valorUnitario: null }],
    });
  });

  it('I-05 busca por empresa (sem diferenciar maiúsculas), código e item', async () => {
    for (const q of ['Clínica', 'clínica', 'OPP-2003', 'squeeze']) {
      const res = await get(`/oportunidades?q=${encodeURIComponent(q)}`);
      expect(codigos(res), q).toEqual(['OPP-2003']);
    }
    // sem `unaccent`: busca sem acento não encontra (limitação declarada no README)
    expect(codigos(await get('/oportunidades?q=clinica'))).toEqual([]);
  });

  it('I-06 filtro por etapa (inclusive lista separada por vírgula)', async () => {
    expect(codigos(await get('/oportunidades?etapa=FOLLOW_UP'))).toEqual(['OPP-2003', 'OPP-2004']);
    expect((await get('/oportunidades?etapa=FORECAST,FECHAMENTO')).body.total).toBe(2);
    expect((await get('/oportunidades?etapa=XYZ')).status).toBe(400);
  });

  it('I-07 filtro por vendedor', async () => {
    expect(codigos(await get(`/oportunidades?vendedorId=${v.Ana}`)).sort()).toEqual(['OPP-2001', 'OPP-2003', 'OPP-2007']);
  });

  it('I-08 só com atenção', async () => {
    expect(codigos(await get('/oportunidades?atencao=true'))).toEqual(['OPP-2003', 'OPP-2002', 'OPP-2004', 'OPP-2001']);
  });

  it('I-09 severidade mínima ALTA', async () => {
    expect(codigos(await get('/oportunidades?severidade=ALTA'))).toEqual(['OPP-2003', 'OPP-2002', 'OPP-2004']);
    expect((await get('/oportunidades?severidade=CRITICA')).body.total).toBe(1);
  });

  it('I-10 sem as finais', async () => {
    const res = await get('/oportunidades?incluirFinais=false');
    expect(res.body.total).toBe(5);
    expect(codigos(res)).not.toContain('OPP-2006');
  });

  it('ordenações alternativas', async () => {
    expect(codigos(await get('/oportunidades?ordem=valor'))[0]).toBe('OPP-2005');
    expect(codigos(await get('/oportunidades?ordem=codigo'))).toEqual([
      'OPP-2001', 'OPP-2002', 'OPP-2003', 'OPP-2004', 'OPP-2005', 'OPP-2006', 'OPP-2007',
    ]);
    expect(codigos(await get('/oportunidades?ordem=ultimoContato'))[0]).toBe('OPP-2007');
  });
});

describe('detalhe', () => {
  it('I-11 detalhe por código e por uuid, com histórico e transições permitidas', async () => {
    const porCodigo = await get('/oportunidades/OPP-2003');
    expect(porCodigo.status).toBe(200);
    const porId = await get(`/oportunidades/${porCodigo.body.id}`);
    expect(porId.status).toBe(200);
    expect(porId.body.codigo).toBe('OPP-2003');

    const { historico, transicoesPermitidas } = porCodigo.body;
    expect(historico).toHaveLength(3);
    expect(historico.map((h: any) => `${h.deEtapa}>${h.paraEtapa}`)).toEqual([
      'null>PRIMEIRO_CONTATO',
      'PRIMEIRO_CONTATO>APRESENTACAO_ORCAMENTO',
      'APRESENTACAO_ORCAMENTO>FOLLOW_UP',
    ]);
    expect(historico[0].vendedor.nome).toBe('Ana');
    expect(transicoesPermitidas).toEqual([
      { para: 'FORECAST', exigeMotivo: false, tipo: 'avanco' },
      { para: 'APRESENTACAO_ORCAMENTO', exigeMotivo: true, tipo: 'retorno' },
      { para: 'PERDIDA', exigeMotivo: true, tipo: 'perda' },
    ]);
    expect(porCodigo.body).toMatchObject({ cnpj: null, contatoNome: null, motivoPerda: null, followUps: [] });

    const hist = await get('/oportunidades/OPP-2003/historico');
    expect(hist.body.itens).toEqual(historico);
  });

  it('I-12 código inexistente → 404', async () => {
    const res = await get('/oportunidades/OPP-9999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'OPORTUNIDADE_NAO_ENCONTRADA', message: 'Oportunidade não encontrada.' });
  });
});

describe('criação e edição', () => {
  const nova = {
    empresa: 'Hotel Atlântico',
    valorEstimado: 15000,
    ultimoContato: '2026-10-15',
    eventoCliente: '2026-11-20',
    itens: [{ descricao: 'Kit boas-vindas', quantidade: 200 }],
  };

  it('I-13 POST sem identidade → 401 IDENTIDADE_AUSENTE', async () => {
    const res = await chamar(ctx.app, 'POST', '/oportunidades', { body: nova });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('IDENTIDADE_AUSENTE');
  });

  it('sem identidade, 401 vem antes da validação do corpo', async () => {
    const invalido = { empresa: '', valorEstimado: -1 };
    expect((await chamar(ctx.app, 'POST', '/oportunidades', { body: invalido })).status).toBe(401);
    expect((await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2001', { body: { valorEstimado: 'x' } })).status).toBe(401);
    expect((await chamar(ctx.app, 'POST', '/oportunidades/OPP-2001/contatos', { body: { data: 'ontem' } })).status).toBe(401);
    expect((await transicionarSemIdentidade({ para: 'GANHA' })).status).toBe(401);
    const concluir = await chamar(ctx.app, 'POST', '/follow-ups/x/concluir', { body: { registrarContato: 'sim' } });
    expect(concluir.status).toBe(401);
    // com identidade, o mesmo corpo inválido cai na validação
    expect((await chamar(ctx.app, 'POST', '/oportunidades', { body: invalido, vendedorId: v.Ana })).status).toBe(400);
  });

  it('I-14 POST com vendedor inexistente → 401 IDENTIDADE_INVALIDA', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'nao-e-uuid']) {
      const res = await chamar(ctx.app, 'POST', '/oportunidades', { body: nova, vendedorId: id });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('IDENTIDADE_INVALIDA');
    }
  });

  it('I-15 POST válido cria OPP-2008 em Primeiro Contato com histórico de criação', async () => {
    const res = await chamar(ctx.app, 'POST', '/oportunidades', { body: nova, vendedorId: v.Carla });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      codigo: 'OPP-2008',
      etapa: 'PRIMEIRO_CONTATO',
      empresa: 'Hotel Atlântico',
      vendedor: { id: v.Carla, nome: 'Carla' },
      valorEstimado: 15000,
      itens: [{ descricao: 'Kit boas-vindas', quantidade: 200, valorUnitario: null }],
    });
    expect(res.body.historico).toHaveLength(1);
    expect(res.body.historico[0]).toMatchObject({ deEtapa: null, paraEtapa: 'PRIMEIRO_CONTATO', vendedor: { nome: 'Carla' } });

    // dono diferente do executor
    const outra = await chamar(ctx.app, 'POST', '/oportunidades', {
      body: { empresa: 'Mercado Central', vendedorId: v.Ana },
      vendedorId: v.Bruno,
    });
    expect(outra.body).toMatchObject({ codigo: 'OPP-2009', vendedor: { nome: 'Ana' }, valorEstimado: null, itens: [] });
    expect(outra.body.historico[0].vendedor.nome).toBe('Bruno');
  });

  it('I-16 ultimoContato futuro ou data inexistente → 400 VALIDACAO', async () => {
    const futuro = await chamar(ctx.app, 'POST', '/oportunidades', {
      body: { ...nova, ultimoContato: '2026-10-16' },
      vendedorId: v.Ana,
    });
    expect(futuro.status).toBe(400);
    expect(futuro.body.code).toBe('VALIDACAO');
    expect(futuro.body.details.issues[0].campo).toBe('ultimoContato');

    const inexistente = await chamar(ctx.app, 'POST', '/oportunidades', {
      body: { ...nova, ultimoContato: '2026-02-31' },
      vendedorId: v.Ana,
    });
    expect(inexistente.status).toBe(400);
    expect(inexistente.body.code).toBe('VALIDACAO');
  });

  it('I-17 empresa curta, campo desconhecido ou valor negativo → 400', async () => {
    for (const body of [
      { ...nova, empresa: 'A' },
      { ...nova, etapa: 'FECHAMENTO' },
      { ...nova, valorEstimado: -1 },
      { ...nova, itens: [{ descricao: 'Caneca', quantidade: 0 }] },
    ]) {
      const res = await chamar(ctx.app, 'POST', '/oportunidades', { body, vendedorId: v.Ana });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.code).toBe('VALIDACAO');
      expect(res.body.message).toBeTruthy();
    }
  });

  it('I-18 PATCH de campo em oportunidade final → 409 OPORTUNIDADE_FINALIZADA', async () => {
    const res = await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2006', {
      body: { empresa: 'Escola Saber 2' },
      vendedorId: v.Carla,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OPORTUNIDADE_FINALIZADA');
  });

  it('I-19 PATCH só de observações em final → 200', async () => {
    const res = await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2006', {
      body: { observacoes: 'Entrega confirmada.' },
      vendedorId: v.Carla,
    });
    expect(res.status).toBe(200);
    expect(res.body.observacoes).toBe('Entrega confirmada.');
  });

  it('I-20 PATCH itens substitui a lista inteira', async () => {
    const res = await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2001', {
      body: {
        itens: [
          { descricao: 'Caneca térmica', quantidade: 150, valorUnitario: 18.5 },
          { descricao: 'Ecobag', quantidade: 150 },
        ],
      },
      vendedorId: v.Ana,
    });
    expect(res.status).toBe(200);
    expect(res.body.itens.map((i: any) => [i.descricao, i.quantidade, i.valorUnitario])).toEqual([
      ['Caneca térmica', 150, 18.5],
      ['Ecobag', 150, null],
    ]);
    expect(await ctx.prisma.itemBrinde.count({ where: { oportunidade: { codigo: 'OPP-2001' } } })).toBe(2);
  });
});

describe('transições de etapa', () => {
  it('I-21 OPP-2005 Forecast → Fechamento grava histórico com o executor', async () => {
    const res = await transicionar('OPP-2005', v.Bruno, { para: 'FECHAMENTO' });
    expect(res.status).toBe(200);
    expect(res.body.etapa).toBe('FECHAMENTO');
    expect(res.body.transicoesPermitidas).toEqual([]);
    expect(res.body.historico).toHaveLength(5);
    expect(res.body.historico.at(-1)).toMatchObject({
      deEtapa: 'FORECAST',
      paraEtapa: 'FECHAMENTO',
      motivo: null,
      vendedor: { nome: 'Bruno' },
    });
    expect(Date.parse(res.body.historico.at(-1).createdAt)).not.toBeNaN();

    const depois = await transicionar('OPP-2005', v.Bruno, { para: 'FORECAST', motivo: 'Cliente desistiu' });
    expect(depois.status).toBe(422);
    expect(depois.body.code).toBe('ETAPA_FINAL');
    await esperarInalterada('OPP-2005', 'FECHAMENTO', 5);
  });

  it('I-22 OPP-2003 Follow-up → Fechamento: 422 e nada muda', async () => {
    const antes = await contarHistorico('OPP-2003');
    const res = await transicionar('OPP-2003', v.Ana, { para: 'FECHAMENTO' });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      code: 'FECHAMENTO_SO_DE_FORECAST',
      message: 'Só é possível fechar uma oportunidade que esteja em Forecast.',
    });
    expect((await get('/oportunidades/OPP-2003')).body.etapa).toBe('FOLLOW_UP');
    expect(await contarHistorico('OPP-2003')).toBe(antes);
    await esperarInalterada('OPP-2003', 'FOLLOW_UP', 3);
  });

  it('I-23 Perdida sem motivo → 422 MOTIVO_PERDA_OBRIGATORIO', async () => {
    for (const body of [{ para: 'PERDIDA' }, { para: 'PERDIDA', motivo: '   ' }, { para: 'PERDIDA', motivo: 'caro' }]) {
      const res = await transicionar('OPP-2002', v.Bruno, body);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('MOTIVO_PERDA_OBRIGATORIO');
    }
    expect((await get('/oportunidades/OPP-2002')).body.etapa).toBe('APRESENTACAO_ORCAMENTO');
    expect(await contarHistorico('OPP-2002')).toBe(2);
    await esperarInalterada('OPP-2002', 'APRESENTACAO_ORCAMENTO', 2);
  });

  it('I-24 Perdida com motivo grava motivoPerda e histórico', async () => {
    const motivo = '  Cliente fechou com concorrente por preço.  ';
    const res = await transicionar('OPP-2002', v.Bruno, { para: 'PERDIDA', motivo });
    expect(res.status).toBe(200);
    expect(res.body.etapa).toBe('PERDIDA');
    expect(res.body.motivoPerda).toBe('Cliente fechou com concorrente por preço.');
    expect(res.body.historico.at(-1)).toMatchObject({
      deEtapa: 'APRESENTACAO_ORCAMENTO',
      paraEtapa: 'PERDIDA',
      motivo: 'Cliente fechou com concorrente por preço.',
      vendedor: { nome: 'Bruno' },
    });
  });

  it('I-25 OPP-2001 → Apresentação sem validade: 422 com campos faltantes', async () => {
    const res = await transicionar('OPP-2001', v.Ana, { para: 'APRESENTACAO_ORCAMENTO' });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      code: 'PRE_CONDICAO_NAO_ATENDIDA',
      message: 'Para apresentar o orçamento, informe: validade da proposta.',
      details: { faltando: ['validadeProposta'] },
    });
    await esperarInalterada('OPP-2001', 'PRIMEIRO_CONTATO', 1);
  });

  it('I-26 PATCH validade e depois → Apresentação: 200', async () => {
    const patch = await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2001', {
      body: { validadeProposta: '2026-10-30' },
      vendedorId: v.Ana,
    });
    expect(patch.status).toBe(200);
    expect(patch.body.transicoesPermitidas.map((t: any) => t.para)).toEqual(['APRESENTACAO_ORCAMENTO', 'PERDIDA']);
    const res = await transicionar('OPP-2001', v.Ana, { para: 'APRESENTACAO_ORCAMENTO' });
    expect(res.status).toBe(200);
    expect(res.body.etapa).toBe('APRESENTACAO_ORCAMENTO');
  });

  it('I-27 OPP-2004 com proposta vencida → Forecast: 422 PROPOSTA_VENCIDA', async () => {
    const res = await transicionar('OPP-2004', v.Carla, { para: 'FORECAST' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PROPOSTA_VENCIDA');
    expect(res.body.message).toContain('10/10/2026');
    await esperarInalterada('OPP-2004', 'FOLLOW_UP', 3);
  });

  it('I-28 retorno exige motivo; com motivo grava no histórico', async () => {
    const sem = await transicionar('OPP-2003', v.Ana, { para: 'APRESENTACAO_ORCAMENTO' });
    expect(sem.status).toBe(422);
    expect(sem.body.code).toBe('MOTIVO_RETORNO_OBRIGATORIO');
    await esperarInalterada('OPP-2003', 'FOLLOW_UP', 3);
    const com = await transicionar('OPP-2003', v.Ana, {
      para: 'APRESENTACAO_ORCAMENTO',
      motivo: 'Cliente pediu revisão de quantidade',
    });
    expect(com.status).toBe(200);
    expect(com.body.historico.at(-1)).toMatchObject({
      deEtapa: 'FOLLOW_UP',
      paraEtapa: 'APRESENTACAO_ORCAMENTO',
      motivo: 'Cliente pediu revisão de quantidade',
    });
  });

  it('I-28b retorno para Primeiro Contato e salto são bloqueados', async () => {
    const retorno = await transicionar('OPP-2003', v.Ana, { para: 'PRIMEIRO_CONTATO', motivo: 'Dados errados' });
    expect(retorno.status).toBe(422);
    expect(retorno.body.code).toBe('RETORNO_NAO_PERMITIDO');
    await esperarInalterada('OPP-2003', 'FOLLOW_UP', 3);
    const salto = await transicionar('OPP-2001', v.Ana, { para: 'FOLLOW_UP' });
    expect(salto.status).toBe(422);
    expect(salto.body).toMatchObject({ code: 'SALTO_DE_ETAPA', details: { proxima: 'APRESENTACAO_ORCAMENTO' } });
    await esperarInalterada('OPP-2001', 'PRIMEIRO_CONTATO', 1);
  });

  it('I-29 oportunidade final não muda de etapa', async () => {
    for (const para of ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', 'FOLLOW_UP', 'FORECAST', 'PERDIDA']) {
      const res = await transicionar('OPP-2006', v.Carla, { para, motivo: 'Motivo qualquer' });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('ETAPA_FINAL');
    }
    await esperarInalterada('OPP-2006', 'FECHAMENTO', 5);
  });

  it('I-29b etapa inválida, oportunidade inexistente e sem identidade', async () => {
    expect((await transicionar('OPP-2003', v.Ana, { para: 'GANHA' })).status).toBe(400);
    expect((await transicionar('OPP-9999', v.Ana, { para: 'FORECAST' })).status).toBe(404);
    const semIdentidade = await chamar(ctx.app, 'POST', '/oportunidades/OPP-2003/transicoes', { body: { para: 'FORECAST' } });
    expect(semIdentidade.status).toBe(401);
  });

  it('I-30 atomicidade: falha ao gravar o histórico desfaz a mudança de etapa', async () => {
    const executorInexistente = { id: '00000000-0000-4000-8000-000000000000', nome: 'Fantasma' };
    // A FK de transicoes_etapa.vendedor_id falha *depois* do update da etapa, dentro da transação.
    await expect(
      ctx.app.servicos.transicoes.transicionar('OPP-2005', 'FECHAMENTO' as never, null, executorInexistente),
    ).rejects.toThrow();
    expect((await get('/oportunidades/OPP-2005')).body.etapa).toBe('FORECAST');
    expect(await contarHistorico('OPP-2005')).toBe(4);
  });
});

describe('registro de contato', () => {
  it('I-31 registra contato hoje e anexa observação com a data', async () => {
    const res = await chamar(ctx.app, 'POST', '/oportunidades/OPP-2004/contatos', { body: {}, vendedorId: v.Carla });
    expect(res.status).toBe(200);
    expect(res.body.ultimoContato).toBe('2026-10-15');
    expect(res.body.diasSemContato).toBe(0);
    expect(res.body.atencao.sinais.map((s: any) => s.tipo)).toEqual(['PROPOSTA_VENCIDA']);

    const comObs = await chamar(ctx.app, 'POST', '/oportunidades/OPP-2004/contatos', {
      body: { observacao: 'Cliente pediu nova proposta.' },
      vendedorId: v.Carla,
    });
    expect(comObs.body.observacoes).toBe('[2026-10-15] Cliente pediu nova proposta.');

    const semCorpo = await chamar(ctx.app, 'POST', '/oportunidades/OPP-2002/contatos', { vendedorId: v.Bruno });
    expect(semCorpo.status).toBe(200);
    expect(semCorpo.body.ultimoContato).toBe('2026-10-15');
  });

  it('contato no futuro → 400; em oportunidade final → 409; data antiga não regride', async () => {
    const futuro = await chamar(ctx.app, 'POST', '/oportunidades/OPP-2004/contatos', {
      body: { data: '2026-10-20' },
      vendedorId: v.Carla,
    });
    expect(futuro.status).toBe(400);
    const final = await chamar(ctx.app, 'POST', '/oportunidades/OPP-2007/contatos', { body: {}, vendedorId: v.Ana });
    expect(final.status).toBe(409);
    const antigo = await chamar(ctx.app, 'POST', '/oportunidades/OPP-2005/contatos', {
      body: { data: '2026-10-01' },
      vendedorId: v.Bruno,
    });
    expect(antigo.body.ultimoContato).toBe('2026-10-15');
  });
});

describe('comportamentos transversais', () => {
  it('I-40 rate limit configurado (headers presentes)', async () => {
    const res = await get('/health');
    expect(res.headers['x-ratelimit-limit']).toBe('300');
  });

  it('x-request-id é sempre gerado pelo servidor (o enviado pelo cliente é ignorado)', async () => {
    const res = await chamar(ctx.app, 'GET', '/health', { headers: { 'x-request-id': 'forjado-pelo-cliente' } });
    expect(res.headers['x-request-id']).not.toBe('forjado-pelo-cliente');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const preflight = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/oportunidades',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-vendedor-id',
      },
    });
    expect(preflight.headers['access-control-allow-headers']).toBe('content-type, x-vendedor-id');
  });

  it('I-41 erro inesperado → 500 genérico, sem stack nem mensagem interna', async () => {
    const res = await get('/__teste/erro');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('ERRO_INTERNO');
    expect(JSON.stringify(res.body)).not.toMatch(/falha simulada|stack|at /);
  });

  it('rota inexistente e JSON malformado seguem o formato de erro', async () => {
    const naoExiste = await get('/nao-existe');
    expect(naoExiste.status).toBe(404);
    expect(naoExiste.body.code).toBe('ROTA_NAO_ENCONTRADA');
    const malformado = await ctx.app.inject({
      method: 'POST',
      url: '/oportunidades',
      headers: { 'content-type': 'application/json', 'x-vendedor-id': v.Ana },
      payload: '{"empresa":',
    });
    expect(malformado.statusCode).toBe(400);
    expect(JSON.parse(malformado.body)).toMatchObject({ code: 'VALIDACAO' });
  });

  it('banco vazio: listagem 200 com itens vazios', async () => {
    await zerarBanco(ctx.prisma);
    const res = await get('/oportunidades');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hoje: '2026-10-15', total: 0, itens: [] });
  });
});
