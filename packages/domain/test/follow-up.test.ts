import { describe, expect, it } from 'vitest';
import {
  Etapa,
  LIMIARES,
  LIMIARES_FOLLOWUP,
  TipoFollowUp,
  calcularSinais,
  proximaAcao,
  somarDias,
  type OportunidadeDominio,
} from '../src';
import { HOJE, SEED, opNeutra } from './fixtures';

const T = TipoFollowUp;
const COM_PROPOSTA = [Etapa.APRESENTACAO_ORCAMENTO, Etapa.FOLLOW_UP, Etapa.FORECAST];
const NAO_FINAIS = [Etapa.PRIMEIRO_CONTATO, ...COM_PROPOSTA];

function acao(etapa: Etapa, overrides: Partial<OportunidadeDominio> = {}) {
  const a = proximaAcao(opNeutra(etapa, overrides), HOJE);
  return a ? { tipo: a.tipo, prioridade: a.prioridade } : null;
}

const contatoHa = (n: number) => ({ ultimoContato: somarDias(HOJE, -n) });

describe('motor de próxima ação (follow-up)', () => {
  it('F-01 etapas finais nunca geram ação', () => {
    for (const etapa of [Etapa.FECHAMENTO, Etapa.PERDIDA]) {
      expect(acao(etapa, { eventoCliente: somarDias(HOJE, -2), validadeProposta: '2026-10-01', ultimoContato: null })).toBeNull();
    }
  });

  it('oportunidade em dia não gera ação em nenhuma etapa', () => {
    for (const etapa of NAO_FINAIS) expect(acao(etapa)).toBeNull();
  });

  it('F-02 regra 1: evento já passou', () => {
    for (const etapa of NAO_FINAIS) {
      expect(acao(etapa, { eventoCliente: somarDias(HOJE, -1) })).toEqual({ tipo: T.CONFIRMAR_PRAZO_EVENTO, prioridade: 'CRITICA' });
    }
    const a = proximaAcao(opNeutra(Etapa.FOLLOW_UP, { eventoCliente: '2026-10-14' }), HOJE);
    expect(a?.titulo).toBe('Evento do cliente já passou');
    expect(a?.descricao).toContain('14/10/2026');
  });

  it('F-03 regra 2: evento em 0 e 3 dias → CRITICA', () => {
    for (const n of [0, 3]) {
      expect(acao(Etapa.FOLLOW_UP, { eventoCliente: somarDias(HOJE, n) })).toEqual({
        tipo: T.CONFIRMAR_PRAZO_EVENTO,
        prioridade: 'CRITICA',
      });
    }
    expect(proximaAcao(opNeutra(Etapa.FOLLOW_UP, { eventoCliente: '2026-10-18' }), HOJE)?.titulo).toBe(
      'Confirmar prazo: evento em 3 dia(s)',
    );
  });

  it('F-04 regra 3: evento em 4 e 7 dias → ALTA; em 8 dias → nada', () => {
    for (const n of [4, 7]) {
      expect(acao(Etapa.FOLLOW_UP, { eventoCliente: somarDias(HOJE, n) })).toEqual({
        tipo: T.CONFIRMAR_PRAZO_EVENTO,
        prioridade: 'ALTA',
      });
    }
    expect(acao(Etapa.FOLLOW_UP, { eventoCliente: somarDias(HOJE, 8) })).toBeNull();
  });

  it('F-05 regra 4: proposta vencida em AO, FU e FORECAST; não em PC', () => {
    for (const etapa of COM_PROPOSTA) {
      expect(acao(etapa, { validadeProposta: somarDias(HOJE, -1) })).toEqual({
        tipo: T.REVISAR_PROPOSTA_VENCIDA,
        prioridade: 'ALTA',
      });
    }
    expect(acao(Etapa.PRIMEIRO_CONTATO, { validadeProposta: somarDias(HOJE, -1) })).toBeNull();
  });

  it('F-06 regra 5: proposta vence em 0 e 3 dias → MEDIA; em 4 dias → nada', () => {
    for (const etapa of COM_PROPOSTA) {
      for (const n of [0, 3]) {
        expect(acao(etapa, { validadeProposta: somarDias(HOJE, n) })).toEqual({
          tipo: T.RENEGOCIAR_VALIDADE,
          prioridade: 'MEDIA',
        });
      }
      expect(acao(etapa, { validadeProposta: somarDias(HOJE, 4) })).toBeNull();
    }
  });

  it('F-07 regra 6: lead com 1 dia → nada; 2 dias ou sem contato → SLA ALTA', () => {
    expect(acao(Etapa.PRIMEIRO_CONTATO, contatoHa(1))).toBeNull();
    expect(acao(Etapa.PRIMEIRO_CONTATO, contatoHa(2))).toEqual({ tipo: T.PRIMEIRO_CONTATO_SLA, prioridade: 'ALTA' });
    expect(acao(Etapa.PRIMEIRO_CONTATO, { ultimoContato: null })).toEqual({
      tipo: T.PRIMEIRO_CONTATO_SLA,
      prioridade: 'ALTA',
    });
  });

  it('F-08 regra 7: AO com 3 dias → nada; 4 dias → confirmar recebimento MEDIA', () => {
    expect(acao(Etapa.APRESENTACAO_ORCAMENTO, contatoHa(3))).toBeNull();
    expect(acao(Etapa.APRESENTACAO_ORCAMENTO, contatoHa(4))).toEqual({
      tipo: T.CONFIRMAR_RECEBIMENTO_PROPOSTA,
      prioridade: 'MEDIA',
    });
  });

  it('F-09 regras 8 e 9: FU com 5 dias → nada; 6 e 7 → MEDIA; 8 → ALTA', () => {
    expect(acao(Etapa.FOLLOW_UP, contatoHa(5))).toBeNull();
    expect(acao(Etapa.FOLLOW_UP, contatoHa(6))).toEqual({ tipo: T.RETOMAR_NEGOCIACAO, prioridade: 'MEDIA' });
    expect(acao(Etapa.FOLLOW_UP, contatoHa(7))).toEqual({ tipo: T.RETOMAR_NEGOCIACAO, prioridade: 'MEDIA' });
    expect(acao(Etapa.FOLLOW_UP, contatoHa(8))).toEqual({ tipo: T.RETOMAR_NEGOCIACAO, prioridade: 'ALTA' });
    expect(proximaAcao(opNeutra(Etapa.FOLLOW_UP, contatoHa(8)), HOJE)?.titulo).toBe(
      'Retomar negociação (8 dias sem contato)',
    );
    expect(acao(Etapa.FOLLOW_UP, { ultimoContato: null })).toEqual({ tipo: T.RETOMAR_NEGOCIACAO, prioridade: 'ALTA' });
  });

  it('F-10 regra 10: FORECAST com 7 dias → nada; 8 → confirmar fechamento ALTA', () => {
    expect(acao(Etapa.FORECAST, contatoHa(7))).toBeNull();
    expect(acao(Etapa.FORECAST, contatoHa(8))).toEqual({ tipo: T.CONFIRMAR_FECHAMENTO, prioridade: 'ALTA' });
  });

  it('F-11 precedência: evento próximo vence proposta vencida e falta de contato', () => {
    const overrides = { eventoCliente: somarDias(HOJE, 2), validadeProposta: somarDias(HOJE, -1), ...contatoHa(20) };
    for (const etapa of COM_PROPOSTA) {
      expect(acao(etapa, overrides)?.tipo).toBe(T.CONFIRMAR_PRAZO_EVENTO);
    }
  });

  it('F-12 precedência: proposta vencida vence falta de contato', () => {
    for (const etapa of COM_PROPOSTA) {
      expect(acao(etapa, { validadeProposta: somarDias(HOJE, -1), ...contatoHa(20) })?.tipo).toBe(
        T.REVISAR_PROPOSTA_VENCIDA,
      );
    }
  });

  it('F-13 seed em 15/10/2026 gera exatamente as 3 ações esperadas', () => {
    const resultado = Object.fromEntries(
      SEED.map((op) => {
        const a = proximaAcao(op, HOJE);
        return [op.codigo, a ? `${a.tipo} ${a.prioridade}` : null];
      }),
    );
    expect(resultado).toEqual({
      'OPP-2001': null,
      'OPP-2002': 'REVISAR_PROPOSTA_VENCIDA ALTA',
      'OPP-2003': 'CONFIRMAR_PRAZO_EVENTO CRITICA',
      'OPP-2004': 'REVISAR_PROPOSTA_VENCIDA ALTA',
      'OPP-2005': null,
      'OPP-2006': null,
      'OPP-2007': null,
    });
  });

  it('F-14 coerência com os sinais: toda ação (exceto antecipações 7 e 9) tem sinal correspondente', () => {
    const datas = [null, ...[-10, -8, -7, -6, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 7, 8, 12].map((n) => somarDias(HOJE, n))];
    const contatos = [null, ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15].map((n) => somarDias(HOJE, -n))];
    let verificados = 0;
    for (const etapa of NAO_FINAIS) {
      for (const eventoCliente of datas) {
        for (const validadeProposta of datas) {
          for (const ultimoContato of contatos) {
            const op = opNeutra(etapa, { eventoCliente, validadeProposta, ultimoContato });
            const a = proximaAcao(op, HOJE);
            if (a === null) continue;
            const antecipacao =
              a.tipo === T.CONFIRMAR_RECEBIMENTO_PROPOSTA || (a.tipo === T.RETOMAR_NEGOCIACAO && a.prioridade === 'MEDIA');
            if (antecipacao) continue;
            verificados++;
            expect(calcularSinais(op, HOJE).length, JSON.stringify(op)).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(verificados).toBeGreaterThan(1000);
  });

  it('limiares compartilhados com os sinais vêm de uma única fonte (LIMIARES)', () => {
    expect(LIMIARES_FOLLOWUP).toMatchObject({
      EVENTO_CRITICO_DIAS: LIMIARES.EVENTO_CRITICO_DIAS,
      EVENTO_ALERTA_DIAS: LIMIARES.EVENTO_ALERTA_DIAS,
      PROPOSTA_VENCENDO_DIAS: LIMIARES.PROPOSTA_VENCENDO_DIAS,
      LEAD_SLA_DIAS: LIMIARES.LEAD_SEM_CONTATO_DIAS,
      SEM_CONTATO_DIAS: LIMIARES.SEM_CONTATO_DIAS,
    });
    // os intermediários antecipam a ação: ficam entre o SLA do lead e o limiar de "sem contato"
    expect(LIMIARES_FOLLOWUP.CONFIRMAR_RECEBIMENTO_DIAS).toBeLessThan(LIMIARES.SEM_CONTATO_DIAS);
    expect(LIMIARES_FOLLOWUP.RETOMADA_PREVENTIVA_DIAS).toBeLessThan(LIMIARES.SEM_CONTATO_DIAS);
  });
});
