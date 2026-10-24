import { describe, expect, it } from 'vitest';
import {
  Etapa,
  TipoSinal,
  atingeSeveridade,
  avaliarAtencao,
  calcularScore,
  calcularSinais,
  compararPrioridade,
  severidadeGeral,
  somarDias,
} from '../src';
import { HOJE, SEED, opNeutra } from './fixtures';

const COM_PROPOSTA = [Etapa.APRESENTACAO_ORCAMENTO, Etapa.FOLLOW_UP, Etapa.FORECAST];

function tipos(etapa: Etapa, overrides: Parameters<typeof opNeutra>[1] = {}) {
  return calcularSinais(opNeutra(etapa, overrides), HOJE).map((s) => s.tipo);
}

function sinal(etapa: Etapa, tipo: TipoSinal, overrides: Parameters<typeof opNeutra>[1] = {}) {
  return calcularSinais(opNeutra(etapa, overrides), HOJE).find((s) => s.tipo === tipo);
}

describe('sinais de atenção', () => {
  it('A-01 etapas finais não têm sinais, score 0 e severidade null', () => {
    for (const etapa of [Etapa.FECHAMENTO, Etapa.PERDIDA]) {
      const op = opNeutra(etapa, { eventoCliente: '2026-10-01', validadeProposta: '2026-10-01', ultimoContato: null });
      expect(avaliarAtencao(op, HOJE)).toEqual({ severidade: null, score: 0, sinais: [] });
    }
  });

  it('A-02 evento já passou → CRITICA 120', () => {
    const s = sinal(Etapa.FOLLOW_UP, TipoSinal.EVENTO_PASSOU, { eventoCliente: somarDias(HOJE, -1) });
    expect(s).toMatchObject({ severidade: 'CRITICA', peso: 120 });
    expect(s?.mensagem).toBe('Evento do cliente foi em 14/10/2026 e a venda não fechou.');
  });

  it('A-03 evento em 0 e 3 dias → CRITICA 100', () => {
    for (const n of [0, 3]) {
      const s = sinal(Etapa.FOLLOW_UP, TipoSinal.EVENTO_PROXIMO, { eventoCliente: somarDias(HOJE, n) });
      expect(s).toMatchObject({ severidade: 'CRITICA', peso: 100 });
    }
    expect(sinal(Etapa.FOLLOW_UP, TipoSinal.EVENTO_PROXIMO, { eventoCliente: '2026-10-18' })?.mensagem).toBe(
      'Evento do cliente em 3 dia(s) (18/10/2026).',
    );
  });

  it('A-04 evento em 4 e 7 dias → ALTA 60', () => {
    for (const n of [4, 7]) {
      const s = sinal(Etapa.FOLLOW_UP, TipoSinal.EVENTO_PROXIMO, { eventoCliente: somarDias(HOJE, n) });
      expect(s).toMatchObject({ severidade: 'ALTA', peso: 60 });
    }
  });

  it('A-05 evento em 8 dias → sem sinal de evento', () => {
    expect(tipos(Etapa.FOLLOW_UP, { eventoCliente: somarDias(HOJE, 8) })).toEqual([]);
  });

  it('A-06 proposta vencida em AO, FU e FORECAST → ALTA 50', () => {
    for (const etapa of COM_PROPOSTA) {
      const s = sinal(etapa, TipoSinal.PROPOSTA_VENCIDA, { validadeProposta: somarDias(HOJE, -1) });
      expect(s).toMatchObject({ severidade: 'ALTA', peso: 50, mensagem: 'Proposta vencida em 14/10/2026.' });
    }
  });

  it('A-07 validade vencida em Primeiro Contato não gera sinal de proposta', () => {
    expect(tipos(Etapa.PRIMEIRO_CONTATO, { validadeProposta: somarDias(HOJE, -1) })).toEqual([]);
  });

  it('A-08 proposta vence em 0 e 3 dias → MEDIA 30', () => {
    for (const etapa of COM_PROPOSTA) {
      for (const n of [0, 3]) {
        const s = sinal(etapa, TipoSinal.PROPOSTA_VENCE_EM_BREVE, { validadeProposta: somarDias(HOJE, n) });
        expect(s).toMatchObject({ severidade: 'MEDIA', peso: 30 });
      }
    }
  });

  it('A-09 proposta vence em 4 dias → sem sinal', () => {
    expect(tipos(Etapa.FOLLOW_UP, { validadeProposta: somarDias(HOJE, 4) })).toEqual([]);
  });

  it('A-10 lead com contato há 1 dia → sem sinal', () => {
    expect(tipos(Etapa.PRIMEIRO_CONTATO, { ultimoContato: somarDias(HOJE, -1) })).toEqual([]);
  });

  it('A-11 lead com contato há 2 dias ou sem contato → ALTA 45', () => {
    const s = sinal(Etapa.PRIMEIRO_CONTATO, TipoSinal.SEM_CONTATO, { ultimoContato: somarDias(HOJE, -2) });
    expect(s).toMatchObject({ severidade: 'ALTA', peso: 45, mensagem: 'Lead sem primeiro contato há 2 dias (SLA).' });
    const nulo = sinal(Etapa.PRIMEIRO_CONTATO, TipoSinal.SEM_CONTATO, { ultimoContato: null });
    expect(nulo).toMatchObject({ severidade: 'ALTA', peso: 45 });
    const comCriacao = sinal(Etapa.PRIMEIRO_CONTATO, TipoSinal.SEM_CONTATO, {
      ultimoContato: null,
      criadaEm: somarDias(HOJE, -3),
    });
    expect(comCriacao?.mensagem).toBe('Lead sem primeiro contato há 3 dias (SLA).');
  });

  it('A-12 negociação com contato há 7 dias → sem sinal', () => {
    expect(tipos(Etapa.FOLLOW_UP, { ultimoContato: somarDias(HOJE, -7) })).toEqual([]);
  });

  it('A-13 negociação com contato há 8 dias ou sem contato → ALTA 40', () => {
    for (const etapa of COM_PROPOSTA) {
      const s = sinal(etapa, TipoSinal.SEM_CONTATO, { ultimoContato: somarDias(HOJE, -8) });
      expect(s).toMatchObject({ severidade: 'ALTA', peso: 40, mensagem: 'Sem contato há 8 dias.' });
      expect(sinal(etapa, TipoSinal.SEM_CONTATO, { ultimoContato: null })).toMatchObject({
        peso: 40,
        mensagem: 'Nenhum contato registrado.',
      });
    }
  });

  it('A-14 dados incompletos em PC sem validade → BAIXA 10', () => {
    const s = sinal(Etapa.PRIMEIRO_CONTATO, TipoSinal.DADOS_INCOMPLETOS, { validadeProposta: null });
    expect(s).toMatchObject({ severidade: 'BAIXA', peso: 10 });
    expect(s?.mensagem).toBe('Faltam dados para apresentar orçamento: validade da proposta.');
  });

  it('A-15 dados incompletos fora de PC → sem sinal', () => {
    for (const etapa of COM_PROPOSTA) {
      expect(tipos(etapa, { validadeProposta: null, valorEstimado: null, itens: [] })).toEqual([]);
    }
  });

  it('A-16 sinais mutuamente exclusivos (evento passou × próximo; vencida × vence em breve)', () => {
    for (let n = -5; n <= 10; n++) {
      const t = tipos(Etapa.FOLLOW_UP, { eventoCliente: somarDias(HOJE, n), validadeProposta: somarDias(HOJE, n) });
      expect(t.filter((x) => x === TipoSinal.EVENTO_PASSOU || x === TipoSinal.EVENTO_PROXIMO).length).toBeLessThanOrEqual(1);
      expect(
        t.filter((x) => x === TipoSinal.PROPOSTA_VENCIDA || x === TipoSinal.PROPOSTA_VENCE_EM_BREVE).length,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('A-17 score com bônus por valor: 50 + 19', () => {
    const op = opNeutra(Etapa.FOLLOW_UP, { validadeProposta: somarDias(HOJE, -1), valorEstimado: 38000 });
    expect(calcularScore(op, calcularSinais(op, HOJE))).toBe(69);
  });

  it('A-18 bônus limitado a 20', () => {
    const op = opNeutra(Etapa.FOLLOW_UP, { validadeProposta: somarDias(HOJE, -1), valorEstimado: 100000 });
    expect(calcularScore(op, calcularSinais(op, HOJE))).toBe(70);
  });

  it('A-19 sem sinais → score 0 mesmo com valor alto', () => {
    const op = opNeutra(Etapa.FORECAST, { valorEstimado: 1_000_000 });
    expect(calcularScore(op, calcularSinais(op, HOJE))).toBe(0);
  });

  it('A-20 seed em 15/10/2026 produz a tabela esperada', () => {
    const resultado = Object.fromEntries(
      SEED.map((op) => {
        const a = avaliarAtencao(op, HOJE);
        return [op.codigo, { sinais: a.sinais.map((s) => s.tipo), severidade: a.severidade, score: a.score }];
      }),
    );
    expect(resultado).toEqual({
      'OPP-2001': { sinais: ['DADOS_INCOMPLETOS'], severidade: 'BAIXA', score: 12.25 },
      'OPP-2002': { sinais: ['PROPOSTA_VENCIDA', 'SEM_CONTATO'], severidade: 'ALTA', score: 94.9 },
      'OPP-2003': { sinais: ['EVENTO_PROXIMO'], severidade: 'CRITICA', score: 103.6 },
      'OPP-2004': { sinais: ['PROPOSTA_VENCIDA', 'SEM_CONTATO'], severidade: 'ALTA', score: 91.95 },
      'OPP-2005': { sinais: [], severidade: null, score: 0 },
      'OPP-2006': { sinais: [], severidade: null, score: 0 },
      'OPP-2007': { sinais: [], severidade: null, score: 0 },
    });
    const mensagens = SEED.flatMap((op) => calcularSinais(op, HOJE).map((s) => `${op.codigo}: ${s.mensagem}`));
    expect(mensagens).toEqual([
      'OPP-2001: Faltam dados para apresentar orçamento: validade da proposta.',
      'OPP-2002: Proposta vencida em 13/10/2026.',
      'OPP-2002: Sem contato há 9 dias.',
      'OPP-2003: Evento do cliente em 3 dia(s) (18/10/2026).',
      'OPP-2004: Proposta vencida em 10/10/2026.',
      'OPP-2004: Sem contato há 13 dias.',
    ]);
  });

  it('A-21 ordenação padrão do seed', () => {
    const ordenados = SEED.map((op) => ({ ...op, score: avaliarAtencao(op, HOJE).score }))
      .reverse()
      .sort(compararPrioridade)
      .map((op) => op.codigo);
    expect(ordenados).toEqual(['OPP-2003', 'OPP-2002', 'OPP-2004', 'OPP-2001', 'OPP-2005', 'OPP-2006', 'OPP-2007']);
  });

  it('severidade geral e filtro por severidade mínima', () => {
    expect(severidadeGeral([])).toBeNull();
    const op = SEED.find((o) => o.codigo === 'OPP-2002');
    expect(severidadeGeral(calcularSinais(op!, HOJE))).toBe('ALTA');
    expect(atingeSeveridade('CRITICA', 'ALTA')).toBe(true);
    expect(atingeSeveridade('ALTA', 'ALTA')).toBe(true);
    expect(atingeSeveridade('BAIXA', 'ALTA')).toBe(false);
    expect(atingeSeveridade(null, 'BAIXA')).toBe(false);
  });

  it('códigos são ordenados numericamente no desempate', () => {
    const base = { etapa: Etapa.FOLLOW_UP, valorEstimado: 100, score: 0 };
    const lista = [{ ...base, codigo: 'OPP-10000' }, { ...base, codigo: 'OPP-9999' }].sort(compararPrioridade);
    expect(lista.map((o) => o.codigo)).toEqual(['OPP-9999', 'OPP-10000']);
  });
});
