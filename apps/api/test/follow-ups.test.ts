import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { executarSeed } from '../prisma/seed-runner';
import type { PrismaClient } from '../src/lib/prisma';
import { iniciarJobFollowUps } from '../src/modules/follow-ups/follow-ups.job';
import { FollowUpsService } from '../src/modules/follow-ups/follow-ups.service';
import { chamar, criarContexto, resetarComSeed, type Contexto, type Vendedores } from './helpers';

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

const recalcular = (vendedorId = v.Ana) => chamar(ctx.app, 'POST', '/follow-ups/recalcular', { vendedorId });
const doVendedor = (vendedorId: string) => chamar(ctx.app, 'GET', '/follow-ups', { vendedorId });

async function abertosDe(codigo: string) {
  return ctx.prisma.followUp.findMany({ where: { status: 'ABERTO', oportunidade: { codigo } } });
}

async function todosDe(codigo: string) {
  return ctx.prisma.followUp.findMany({ where: { oportunidade: { codigo } }, orderBy: { criadoEm: 'asc' } });
}

describe('motor de follow-up via API', () => {
  it('I-32 recalcular após o seed cria as 3 ações; a segunda chamada não muda nada', async () => {
    const primeira = await recalcular();
    expect(primeira.status).toBe(200);
    expect(primeira.body).toEqual({ hoje: '2026-10-15', criados: 3, resolvidos: 0, substituidos: 0, mantidos: 0 });

    const segunda = await recalcular();
    expect(segunda.body).toEqual({ hoje: '2026-10-15', criados: 0, resolvidos: 0, substituidos: 0, mantidos: 3 });
    expect(await ctx.prisma.followUp.count()).toBe(3);
  });

  it('I-33 cada vendedor vê a sua ação (Ana 2003 crítica, Bruno 2002, Carla 2004)', async () => {
    await recalcular();
    const ana = await doVendedor(v.Ana);
    expect(ana.status).toBe(200);
    expect(ana.body.total).toBe(1);
    expect(ana.body.itens[0]).toMatchObject({
      tipo: 'CONFIRMAR_PRAZO_EVENTO',
      prioridade: 'CRITICA',
      titulo: 'Confirmar prazo: evento em 3 dia(s)',
      venceEm: '2026-10-15',
      status: 'ABERTO',
      atrasado: false,
      oportunidade: { codigo: 'OPP-2003', empresa: 'Clínica Vida', etapa: 'FOLLOW_UP', vendedor: { nome: 'Ana' } },
    });
    const bruno = await doVendedor(v.Bruno);
    expect(bruno.body.itens.map((f: any) => `${f.oportunidade.codigo}:${f.tipo}:${f.prioridade}`)).toEqual([
      'OPP-2002:REVISAR_PROPOSTA_VENCIDA:ALTA',
    ]);
    const carla = await doVendedor(v.Carla);
    expect(carla.body.itens.map((f: any) => `${f.oportunidade.codigo}:${f.tipo}:${f.prioridade}`)).toEqual([
      'OPP-2004:REVISAR_PROPOSTA_VENCIDA:ALTA',
    ]);
    // também por query, sem header
    const porQuery = await chamar(ctx.app, 'GET', `/follow-ups?vendedorId=${v.Bruno}`);
    expect(porQuery.body.total).toBe(1);
    // a ação aparece no card (proximaAcao) da listagem
    const lista = await chamar(ctx.app, 'GET', '/oportunidades');
    const proxima = Object.fromEntries(lista.body.itens.map((i: any) => [i.codigo, i.proximaAcao?.tipo ?? null]));
    expect(proxima).toEqual({
      'OPP-2003': 'CONFIRMAR_PRAZO_EVENTO',
      'OPP-2002': 'REVISAR_PROPOSTA_VENCIDA',
      'OPP-2004': 'REVISAR_PROPOSTA_VENCIDA',
      'OPP-2001': null,
      'OPP-2005': null,
      'OPP-2006': null,
      'OPP-2007': null,
    });
  });

  it('GET /follow-ups ordena por prioridade, vencimento e valor; filtra por ate e status', async () => {
    await recalcular(); // Ana: OPP-2003 (crítica)
    const [critica] = await abertosDe('OPP-2003');
    await ctx.prisma.followUp.update({ where: { id: critica!.id }, data: { venceEm: new Date(Date.UTC(2026, 9, 13)) } });
    // dois leads sem contato da Ana (ação ALTA de SLA, vence hoje), o de menor valor criado primeiro
    for (const [empresa, valorEstimado] of [['Lead Pequeno', 1000], ['Lead Grande', 50000]] as const) {
      const res = await chamar(ctx.app, 'POST', '/oportunidades', { body: { empresa, valorEstimado }, vendedorId: v.Ana });
      expect(res.body.proximaAcao).toMatchObject({ prioridade: 'ALTA' });
    }

    const lista = await doVendedor(v.Ana);
    expect(lista.body.total).toBe(3);
    expect(lista.body.itens.map((f: any) => `${f.oportunidade.empresa}:${f.prioridade}:${f.atrasado}`)).toEqual([
      'Clínica Vida:CRITICA:true',
      'Lead Grande:ALTA:false',
      'Lead Pequeno:ALTA:false',
    ]);

    // ate: só o que vence até a data (a crítica venceu em 13/10)
    const ate = await chamar(ctx.app, 'GET', `/follow-ups?vendedorId=${v.Ana}&ate=2026-10-14`);
    expect(ate.body.itens.map((f: any) => f.oportunidade.codigo)).toEqual(['OPP-2003']);

    // status: concluídos não aparecem na lista padrão (ABERTO) e aparecem com status=CONCLUIDO
    await chamar(ctx.app, 'POST', `/follow-ups/${lista.body.itens[2].id}/concluir`, { body: {}, vendedorId: v.Ana });
    const concluidos = await chamar(ctx.app, 'GET', `/follow-ups?vendedorId=${v.Ana}&status=CONCLUIDO`);
    expect(concluidos.body.itens.map((f: any) => `${f.oportunidade.empresa}:${f.status}:${f.atrasado}`)).toEqual([
      'Lead Pequeno:CONCLUIDO:false',
    ]);
    expect((await doVendedor(v.Ana)).body.itens.map((f: any) => f.oportunidade.empresa)).toEqual([
      'Clínica Vida',
      'Lead Grande',
    ]);
  });

  it('I-34 sem header e sem vendedorId → 400; vendedor inexistente → 404', async () => {
    const res = await chamar(ctx.app, 'GET', '/follow-ups');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDACAO');
    const inexistente = await chamar(ctx.app, 'GET', '/follow-ups?vendedorId=00000000-0000-4000-8000-000000000000');
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.code).toBe('VENDEDOR_NAO_ENCONTRADO');
  });

  it('I-35 concluir a ação de OPP-2002 registra contato e gera nova ação do mesmo tipo', async () => {
    await recalcular();
    const [original] = await abertosDe('OPP-2002');
    const res = await chamar(ctx.app, 'POST', `/follow-ups/${original!.id}/concluir`, {
      body: { registrarContato: true },
      vendedorId: v.Bruno,
    });
    expect(res.status).toBe(200);
    expect(res.body.followUp).toMatchObject({ id: original!.id, status: 'CONCLUIDO' });
    expect(res.body.followUp.encerradoEm).toBeTruthy();
    expect(res.body.oportunidade.ultimoContato).toBe('2026-10-15');

    // proposta continua vencida: registrar contato não resolve; nasce um novo aberto do mesmo tipo
    const abertos = await abertosDe('OPP-2002');
    expect(abertos).toHaveLength(1);
    expect(abertos[0]!.tipo).toBe('REVISAR_PROPOSTA_VENCIDA');
    expect(abertos[0]!.id).not.toBe(original!.id);
    expect(res.body.oportunidade.proximaAcao).toMatchObject({ id: abertos[0]!.id, tipo: 'REVISAR_PROPOSTA_VENCIDA' });
    // sinal de "sem contato" sumiu; o de proposta vencida continua
    expect(res.body.oportunidade.atencao.sinais.map((s: any) => s.tipo)).toEqual(['PROPOSTA_VENCIDA']);
  });

  it('I-36 depois, PATCH validade = 29/10 resolve a ação e não cria outra', async () => {
    await recalcular();
    const [original] = await abertosDe('OPP-2002');
    await chamar(ctx.app, 'POST', `/follow-ups/${original!.id}/concluir`, { body: {}, vendedorId: v.Bruno });
    const [segundo] = await abertosDe('OPP-2002');

    const patch = await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2002', {
      body: { validadeProposta: '2026-10-29' },
      vendedorId: v.Bruno,
    });
    expect(patch.status).toBe(200);
    expect(patch.body.proximaAcao).toBeNull();
    expect(await abertosDe('OPP-2002')).toHaveLength(0);
    const historico = await todosDe('OPP-2002');
    expect(historico.map((f) => f.status)).toEqual(['CONCLUIDO', 'RESOLVIDO']);
    expect(historico[1]!.id).toBe(segundo!.id);
    expect((await doVendedor(v.Bruno)).body.total).toBe(0);
  });

  it('I-37 concluir duas vezes → 409; id inexistente → 404; sem identidade → 401', async () => {
    await recalcular();
    const [f] = await abertosDe('OPP-2003');
    expect((await chamar(ctx.app, 'POST', `/follow-ups/${f!.id}/concluir`, { vendedorId: v.Ana })).status).toBe(200);
    const segunda = await chamar(ctx.app, 'POST', `/follow-ups/${f!.id}/concluir`, { vendedorId: v.Ana });
    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe('FOLLOW_UP_JA_ENCERRADO');
    const inexistente = await chamar(ctx.app, 'POST', '/follow-ups/nao-existe/concluir', { vendedorId: v.Ana });
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.code).toBe('FOLLOW_UP_NAO_ENCONTRADO');
    expect((await chamar(ctx.app, 'POST', `/follow-ups/${f!.id}/concluir`)).status).toBe(401);
  });

  it('concluir com falha transitória no recálculo devolve 200 (a conclusão já foi gravada)', async () => {
    await recalcular();
    const [f] = await abertosDe('OPP-2004');
    const espiao = vi
      .spyOn(ctx.app.servicos.followUps, 'recalcularPara')
      .mockRejectedValueOnce(new Error('conexão caiu'));
    try {
      const res = await chamar(ctx.app, 'POST', `/follow-ups/${f!.id}/concluir`, { body: {}, vendedorId: v.Carla });
      expect(res.status).toBe(200);
      expect(res.body.followUp).toMatchObject({ id: f!.id, status: 'CONCLUIDO' });
      expect(res.body.oportunidade.ultimoContato).toBe('2026-10-15');
      expect(espiao).toHaveBeenCalledTimes(1);
    } finally {
      espiao.mockRestore();
    }
    // o próximo recálculo (job) cria a ação que faltou
    expect((await recalcular()).body).toMatchObject({ criados: 1 });
  });

  it('OPP-2003: concluir mantém uma ação crítica enquanto o evento estiver próximo', async () => {
    await recalcular();
    const [f] = await abertosDe('OPP-2003');
    const res = await chamar(ctx.app, 'POST', `/follow-ups/${f!.id}/concluir`, {
      body: { registrarContato: false, observacao: 'Cliente confirmou entrega para 17/10.' },
      vendedorId: v.Ana,
    });
    expect(res.status).toBe(200);
    expect(res.body.oportunidade.ultimoContato).toBe('2026-10-13'); // sem registrar contato
    expect(res.body.oportunidade.observacoes).toBe('[2026-10-15] Cliente confirmou entrega para 17/10.');
    const abertos = await abertosDe('OPP-2003');
    expect(abertos.map((a) => `${a.tipo}:${a.prioridade}`)).toEqual(['CONFIRMAR_PRAZO_EVENTO:CRITICA']);
  });

  it('I-38 substituição: SLA do lead vira ação de evento, sempre com um só aberto', async () => {
    await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2001', { body: { ultimoContato: '2026-10-12' }, vendedorId: v.Ana });
    expect((await abertosDe('OPP-2001')).map((f) => f.tipo)).toEqual(['PRIMEIRO_CONTATO_SLA']);

    await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2001', { body: { eventoCliente: '2026-10-17' }, vendedorId: v.Ana });
    const todos = await todosDe('OPP-2001');
    expect(todos.map((f) => `${f.tipo}:${f.status}`)).toEqual([
      'PRIMEIRO_CONTATO_SLA:SUBSTITUIDO',
      'CONFIRMAR_PRAZO_EVENTO:ABERTO',
    ]);
    expect(todos[1]!.prioridade).toBe('CRITICA');
    expect(todos[0]!.encerradoEm).not.toBeNull();

    const r = await recalcular();
    expect(r.body).toMatchObject({ substituidos: 0, resolvidos: 0 });
    expect(await abertosDe('OPP-2001')).toHaveLength(1);
  });

  it('I-39 índice único parcial impede um segundo ABERTO na mesma oportunidade', async () => {
    await recalcular();
    const op = await ctx.prisma.oportunidade.findUniqueOrThrow({ where: { codigo: 'OPP-2003' } });
    await expect(
      ctx.prisma.followUp.create({
        data: {
          oportunidadeId: op.id,
          tipo: 'RETOMAR_NEGOCIACAO',
          prioridade: 'ALTA',
          titulo: 'duplicado',
          descricao: 'duplicado',
          venceEm: new Date(Date.UTC(2026, 9, 15)),
          status: 'ABERTO',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('corrida job × requisição: recálculos simultâneos deixam uma só ação aberta', async () => {
    const op = await ctx.prisma.oportunidade.findUniqueOrThrow({ where: { codigo: 'OPP-2003' } });
    const servico = ctx.app.servicos.followUps;
    const resultados = await Promise.all([1, 2, 3, 4].map(() => servico.recalcularPara(op.id)));
    expect(resultados.reduce((n, r) => n + r.criados, 0)).toBe(1);
    expect(resultados.reduce((n, r) => n + r.mantidos, 0)).toBe(3);
    expect(await abertosDe('OPP-2003')).toHaveLength(1);
  });

  it('corrida job × requisição: insert concorrente entre a leitura e a escrita é refeito (P2002)', async () => {
    const op = await ctx.prisma.oportunidade.findUniqueOrThrow({ where: { codigo: 'OPP-2003' } });
    let injetado = false;
    // Na primeira escrita, outra conexão (o "job") grava a mesma ação antes: a escrita esbarra no índice único.
    const vincular = <T extends object>(alvo: T, nome: PropertyKey) => {
      const valor = Reflect.get(alvo, nome) as unknown;
      return typeof valor === 'function' ? valor.bind(alvo) : valor;
    };
    const followUpComCorrida = (delegado: PrismaClient['followUp']) =>
      new Proxy(delegado, {
        get: (alvo, nome) =>
          nome === 'create' && !injetado
            ? async (args: Parameters<PrismaClient['followUp']['create']>[0]) => {
                injetado = true;
                await ctx.prisma.followUp.create({ data: args.data });
                return alvo.create(args);
              }
            : vincular(alvo, nome),
      });
    const prismaComCorrida = new Proxy(ctx.prisma, {
      get: (alvo, nome) =>
        nome === '$transaction'
          ? (fn: (tx: unknown) => Promise<unknown>) =>
              alvo.$transaction((tx) =>
                fn(new Proxy(tx, { get: (t, n) => (n === 'followUp' ? followUpComCorrida(t.followUp) : vincular(t, n)) })),
              )
          : vincular(alvo, nome),
    }) as PrismaClient;
    const servico = new FollowUpsService(prismaComCorrida, ctx.app.servicos.relogio, () => ctx.app.servicos.oportunidades);

    const r = await servico.recalcularPara(op.id);

    expect(injetado).toBe(true);
    expect(r).toEqual({ criados: 0, resolvidos: 0, substituidos: 0, mantidos: 1 });
    const abertos = await abertosDe('OPP-2003');
    expect(abertos.map((f) => `${f.tipo}:${f.prioridade}`)).toEqual(['CONFIRMAR_PRAZO_EVENTO:CRITICA']);
  });

  it('I-21/F4 transição para Fechamento resolve a ação aberta e nunca cria outra', async () => {
    // força uma ação aberta em OPP-2005 (contato antigo → confirmar fechamento)
    await chamar(ctx.app, 'PATCH', '/oportunidades/OPP-2005', { body: { ultimoContato: '2026-10-05' }, vendedorId: v.Bruno });
    expect((await abertosDe('OPP-2005')).map((f) => f.tipo)).toEqual(['CONFIRMAR_FECHAMENTO']);

    const res = await chamar(ctx.app, 'POST', '/oportunidades/OPP-2005/transicoes', {
      body: { para: 'FECHAMENTO' },
      vendedorId: v.Bruno,
    });
    expect(res.status).toBe(200);
    expect(res.body.proximaAcao).toBeNull();
    expect((await todosDe('OPP-2005')).map((f) => f.status)).toEqual(['RESOLVIDO']);
    await recalcular(); // cria as ações das outras três; OPP-2005 continua sem nenhuma
    expect(await abertosDe('OPP-2005')).toHaveLength(0);
    expect((await todosDe('OPP-2005')).map((f) => f.status)).toEqual(['RESOLVIDO']);
  });

  it('criação de oportunidade já calcula a ação (lead sem contato → SLA)', async () => {
    const res = await chamar(ctx.app, 'POST', '/oportunidades', { body: { empresa: 'Lead Novo SA' }, vendedorId: v.Carla });
    expect(res.status).toBe(201);
    expect(res.body.proximaAcao).toMatchObject({ tipo: 'PRIMEIRO_CONTATO_SLA', prioridade: 'ALTA' });
  });

  it('ação mantida preserva o vencimento original e aparece como atrasada', async () => {
    await recalcular();
    const [f] = await abertosDe('OPP-2004');
    await ctx.prisma.followUp.update({ where: { id: f!.id }, data: { venceEm: new Date(Date.UTC(2026, 9, 13)) } });
    const r = await recalcular();
    expect(r.body).toMatchObject({ criados: 0, mantidos: 3 });
    const carla = await doVendedor(v.Carla);
    expect(carla.body.itens[0]).toMatchObject({ id: f!.id, venceEm: '2026-10-13', atrasado: true });
  });
});

describe('seed reaplicado (restart da API)', () => {
  it('apaga só os follow-ups abertos e preserva o histórico dos encerrados', async () => {
    await recalcular();
    const [original] = await abertosDe('OPP-2002');
    await chamar(ctx.app, 'POST', `/follow-ups/${original!.id}/concluir`, { body: {}, vendedorId: v.Bruno });
    expect((await todosDe('OPP-2002')).map((f) => f.status)).toEqual(['CONCLUIDO', 'ABERTO']);

    await executarSeed(ctx.prisma);

    expect((await todosDe('OPP-2002')).map((f) => `${f.id === original!.id}:${f.status}`)).toEqual(['true:CONCLUIDO']);
    expect(await ctx.prisma.followUp.count({ where: { status: 'ABERTO' } })).toBe(0);
    // o boot recria as ações do dia sobre o estado restaurado
    expect((await recalcular()).body).toMatchObject({ criados: 3 });
  });
});

describe('job agendado', () => {
  it('roda no boot (com o atraso configurado), registra o resultado e envia o webhook', async () => {
    const recebidos: unknown[] = [];
    const servidor = createServer((req, res) => {
      let corpo = '';
      req.on('data', (c) => (corpo += c));
      req.on('end', () => {
        recebidos.push(JSON.parse(corpo));
        res.end('ok');
      });
    });
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
    const porta = (servidor.address() as AddressInfo).port;
    const logs: Array<Record<string, unknown>> = [];
    const log = {
      info: (o: Record<string, unknown>) => logs.push(o),
      warn: (o: Record<string, unknown>) => logs.push(o),
      error: (o: Record<string, unknown>) => logs.push(o),
    } as never;

    const job = iniciarJobFollowUps({
      servico: ctx.app.servicos.followUps,
      log,
      expressao: '0 * * * *',
      webhookUrl: `http://127.0.0.1:${porta}/webhook`,
      atrasoInicialMs: 10,
    });
    await job.primeiraExecucao;
    job.parar();
    servidor.close();

    expect(logs.find((l) => l.origem === 'boot')).toMatchObject({ criados: 3, resolvidos: 0, substituidos: 0 });
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]).toMatchObject({
      hoje: '2026-10-15',
      resumo: { criados: 3, substituidos: 0, resolvidos: 0 },
      acoes: expect.arrayContaining([
        { codigo: 'OPP-2003', empresa: 'Clínica Vida', vendedor: 'Ana', prioridade: 'CRITICA', titulo: 'Confirmar prazo: evento em 3 dia(s)' },
      ]),
    });
  });

  it('expressão cron inválida falha cedo', () => {
    expect(() =>
      iniciarJobFollowUps({ servico: ctx.app.servicos.followUps, log: {} as never, expressao: 'toda hora' }),
    ).toThrow(/FOLLOWUP_CRON/);
  });
});
