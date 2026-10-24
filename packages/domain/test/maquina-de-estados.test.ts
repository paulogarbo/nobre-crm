import { describe, expect, it } from 'vitest';
import {
  CodigoErroDominio as C,
  Etapa,
  ORDEM_FUNIL,
  TODAS_AS_ETAPAS,
  ehRetorno,
  motivoDeBloqueio,
  transicoesEstruturais,
  transicoesPermitidas,
  validarTransicao,
  type OportunidadeDominio,
  type ResultadoTransicao,
} from '../src';
import { HOJE, opCompleta } from './fixtures';

const MOTIVO = 'Cliente pediu revisão de quantidade';
const NAO_FINAIS = [Etapa.PRIMEIRO_CONTATO, Etapa.APRESENTACAO_ORCAMENTO, Etapa.FOLLOW_UP, Etapa.FORECAST];

function codigo(r: ResultadoTransicao): string {
  return r.ok ? 'OK' : r.code;
}

function emEtapa(etapa: Etapa, overrides: Partial<OportunidadeDominio> = {}) {
  return opCompleta({ etapa, ...overrides });
}

describe('máquina de estados: avanços e pré-condições', () => {
  it('D-01 mesma etapa é inválida', () => {
    for (const etapa of TODAS_AS_ETAPAS) {
      expect(codigo(validarTransicao(emEtapa(etapa), etapa, MOTIVO, HOJE))).toBe(C.MESMA_ETAPA);
    }
  });

  it('D-02 PC → AO com dados completos', () => {
    expect(validarTransicao(opCompleta(), Etapa.APRESENTACAO_ORCAMENTO, null, HOJE)).toEqual({ ok: true });
  });

  it('D-03 bloqueia salto PC → FU', () => {
    const r = validarTransicao(opCompleta(), Etapa.FOLLOW_UP, null, HOJE);
    expect(codigo(r)).toBe(C.SALTO_DE_ETAPA);
    expect(r.ok ? null : r.details).toEqual({ proxima: Etapa.APRESENTACAO_ORCAMENTO });
  });

  it('D-04 bloqueia salto PC → FORECAST', () => {
    expect(codigo(validarTransicao(opCompleta(), Etapa.FORECAST, null, HOJE))).toBe(C.SALTO_DE_ETAPA);
  });

  it('D-05 PC → FECHAMENTO devolve a mensagem específica de fechamento', () => {
    expect(codigo(validarTransicao(opCompleta(), Etapa.FECHAMENTO, null, HOJE))).toBe(C.FECHAMENTO_SO_DE_FORECAST);
  });

  it('D-06 PC → AO sem valor estimado', () => {
    const r = validarTransicao(opCompleta({ valorEstimado: null }), Etapa.APRESENTACAO_ORCAMENTO, null, HOJE);
    expect(codigo(r)).toBe(C.PRE_CONDICAO_NAO_ATENDIDA);
    expect(r.ok ? [] : r.details?.faltando).toContain('valorEstimado');
  });

  it('D-07 PC → AO com valor estimado 0', () => {
    const r = validarTransicao(opCompleta({ valorEstimado: 0 }), Etapa.APRESENTACAO_ORCAMENTO, null, HOJE);
    expect(codigo(r)).toBe(C.PRE_CONDICAO_NAO_ATENDIDA);
    expect(r.ok ? [] : r.details?.faltando).toContain('valorEstimado');
  });

  it('D-08 PC → AO sem itens', () => {
    const r = validarTransicao(opCompleta({ itens: [] }), Etapa.APRESENTACAO_ORCAMENTO, null, HOJE);
    expect(r.ok ? [] : r.details?.faltando).toEqual(['itens']);
  });

  it('D-09 PC → AO com item de quantidade 0', () => {
    const op = opCompleta({ itens: [{ descricao: 'Caneca', quantidade: 0, valorUnitario: null }] });
    const r = validarTransicao(op, Etapa.APRESENTACAO_ORCAMENTO, null, HOJE);
    expect(r.ok ? [] : r.details?.faltando).toEqual(['itens']);
  });

  it('D-10 PC → AO sem validade da proposta', () => {
    const r = validarTransicao(opCompleta({ validadeProposta: null }), Etapa.APRESENTACAO_ORCAMENTO, null, HOJE);
    expect(codigo(r)).toBe(C.PRE_CONDICAO_NAO_ATENDIDA);
    expect(r.ok ? [] : r.details?.faltando).toEqual(['validadeProposta']);
    expect(r.ok ? '' : r.message).toBe('Para apresentar o orçamento, informe: validade da proposta.');
  });

  it('D-11 PC → AO faltando tudo lista os campos em ordem fixa', () => {
    const op = opCompleta({ valorEstimado: null, itens: [], validadeProposta: null });
    const r = validarTransicao(op, Etapa.APRESENTACAO_ORCAMENTO, null, HOJE);
    expect(r.ok ? [] : r.details?.faltando).toEqual(['valorEstimado', 'itens', 'validadeProposta']);
    expect(r.ok ? '' : r.message).toBe(
      'Para apresentar o orçamento, informe: valor estimado, ao menos um item de brinde e validade da proposta.',
    );
  });

  it('D-12 AO → FU', () => {
    expect(validarTransicao(emEtapa(Etapa.APRESENTACAO_ORCAMENTO), Etapa.FOLLOW_UP, null, HOJE).ok).toBe(true);
  });

  it('D-13 AO → FORECAST é salto', () => {
    expect(codigo(validarTransicao(emEtapa(Etapa.APRESENTACAO_ORCAMENTO), Etapa.FORECAST, null, HOJE))).toBe(
      C.SALTO_DE_ETAPA,
    );
  });

  it('D-14 FU → FORECAST com validade igual a hoje e futura', () => {
    for (const validadeProposta of [HOJE, '2026-10-16']) {
      const op = emEtapa(Etapa.FOLLOW_UP, { validadeProposta });
      expect(validarTransicao(op, Etapa.FORECAST, null, HOJE).ok).toBe(true);
    }
  });

  it('D-15 FU → FORECAST com proposta vencida', () => {
    const r = validarTransicao(emEtapa(Etapa.FOLLOW_UP, { validadeProposta: '2026-10-14' }), Etapa.FORECAST, null, HOJE);
    expect(codigo(r)).toBe(C.PROPOSTA_VENCIDA);
    expect(r.ok ? '' : r.message).toContain('14/10/2026');
  });

  it('D-16 FU → FORECAST sem validade (dado inconsistente) é pré-condição não atendida', () => {
    const r = validarTransicao(emEtapa(Etapa.FOLLOW_UP, { validadeProposta: null }), Etapa.FORECAST, null, HOJE);
    expect(codigo(r)).toBe(C.PRE_CONDICAO_NAO_ATENDIDA);
    expect(r.ok ? [] : r.details?.faltando).toEqual(['validadeProposta']);
  });

  it('D-17 FORECAST → FECHAMENTO', () => {
    expect(validarTransicao(emEtapa(Etapa.FORECAST), Etapa.FECHAMENTO, null, HOJE).ok).toBe(true);
  });

  it('D-18 FU → FECHAMENTO e AO → FECHAMENTO', () => {
    for (const etapa of [Etapa.FOLLOW_UP, Etapa.APRESENTACAO_ORCAMENTO]) {
      expect(codigo(validarTransicao(emEtapa(etapa), Etapa.FECHAMENTO, null, HOJE))).toBe(C.FECHAMENTO_SO_DE_FORECAST);
    }
  });
});

describe('máquina de estados: perda e estados finais', () => {
  it('D-19 cada etapa não final → PERDIDA com motivo válido', () => {
    for (const etapa of NAO_FINAIS) {
      expect(validarTransicao(emEtapa(etapa), Etapa.PERDIDA, 'Cliente fechou com concorrente', HOJE).ok).toBe(true);
    }
  });

  it('D-20 PERDIDA sem motivo, com espaços ou com menos de 5 caracteres', () => {
    for (const etapa of NAO_FINAIS) {
      for (const motivo of [undefined, null, '', '   ', 'abcd', '  abcd  ']) {
        expect(codigo(validarTransicao(emEtapa(etapa), Etapa.PERDIDA, motivo, HOJE))).toBe(C.MOTIVO_PERDA_OBRIGATORIO);
      }
    }
  });

  it('D-21 FECHAMENTO → qualquer destino é bloqueado', () => {
    for (const para of TODAS_AS_ETAPAS.filter((e) => e !== Etapa.FECHAMENTO)) {
      expect(codigo(validarTransicao(emEtapa(Etapa.FECHAMENTO), para, MOTIVO, HOJE))).toBe(C.ETAPA_FINAL);
    }
  });

  it('D-22 PERDIDA → qualquer destino é bloqueado', () => {
    for (const para of TODAS_AS_ETAPAS.filter((e) => e !== Etapa.PERDIDA)) {
      expect(codigo(validarTransicao(emEtapa(Etapa.PERDIDA), para, MOTIVO, HOJE))).toBe(C.ETAPA_FINAL);
    }
  });
});

describe('máquina de estados: retornos', () => {
  it('D-23 FU → AO com motivo', () => {
    expect(validarTransicao(emEtapa(Etapa.FOLLOW_UP), Etapa.APRESENTACAO_ORCAMENTO, MOTIVO, HOJE).ok).toBe(true);
  });

  it('D-24 FU → AO sem motivo', () => {
    expect(codigo(validarTransicao(emEtapa(Etapa.FOLLOW_UP), Etapa.APRESENTACAO_ORCAMENTO, ' ', HOJE))).toBe(
      C.MOTIVO_RETORNO_OBRIGATORIO,
    );
  });

  it('D-25 FORECAST → FU com motivo', () => {
    expect(validarTransicao(emEtapa(Etapa.FORECAST), Etapa.FOLLOW_UP, MOTIVO, HOJE).ok).toBe(true);
  });

  it('D-26 FORECAST → AO com motivo', () => {
    expect(validarTransicao(emEtapa(Etapa.FORECAST), Etapa.APRESENTACAO_ORCAMENTO, MOTIVO, HOJE).ok).toBe(true);
  });

  it('D-27 FORECAST → FU/AO sem motivo', () => {
    for (const para of [Etapa.FOLLOW_UP, Etapa.APRESENTACAO_ORCAMENTO]) {
      expect(codigo(validarTransicao(emEtapa(Etapa.FORECAST), para, undefined, HOJE))).toBe(
        C.MOTIVO_RETORNO_OBRIGATORIO,
      );
    }
  });

  it('D-28 nenhum retorno para Primeiro Contato, mesmo com motivo', () => {
    for (const de of [Etapa.APRESENTACAO_ORCAMENTO, Etapa.FOLLOW_UP, Etapa.FORECAST]) {
      const r = validarTransicao(emEtapa(de), Etapa.PRIMEIRO_CONTATO, MOTIVO, HOJE);
      expect(codigo(r)).toBe(C.RETORNO_NAO_PERMITIDO);
      expect(r.ok ? '' : r.message).toContain('Primeiro Contato');
    }
  });

  it('D-29 ehRetorno: tabela verdade (destino antes da origem no funil linear; PERDIDA nunca)', () => {
    for (const de of TODAS_AS_ETAPAS) {
      for (const para of TODAS_AS_ETAPAS) {
        const i = ORDEM_FUNIL.indexOf(de);
        const j = ORDEM_FUNIL.indexOf(para);
        const esperado = i >= 0 && j >= 0 && j < i;
        expect(ehRetorno(de, para), `${de} → ${para}`).toBe(esperado);
      }
    }
    expect(ehRetorno(Etapa.FOLLOW_UP, Etapa.APRESENTACAO_ORCAMENTO)).toBe(true);
    expect(ehRetorno(Etapa.APRESENTACAO_ORCAMENTO, Etapa.FOLLOW_UP)).toBe(false);
    expect(ehRetorno(Etapa.FORECAST, Etapa.PERDIDA)).toBe(false);
    expect(ehRetorno(Etapa.PERDIDA, Etapa.FORECAST)).toBe(false);
  });
});

describe('transições permitidas', () => {
  it('D-30 PC com dados completos → AO (avanço) e PERDIDA (perda, com motivo)', () => {
    expect(transicoesPermitidas(opCompleta(), HOJE)).toEqual([
      { para: Etapa.APRESENTACAO_ORCAMENTO, exigeMotivo: false, tipo: 'avanco' },
      { para: Etapa.PERDIDA, exigeMotivo: true, tipo: 'perda' },
    ]);
  });

  it('D-31 PC sem validade → só PERDIDA', () => {
    expect(transicoesPermitidas(opCompleta({ validadeProposta: null }), HOJE)).toEqual([
      { para: Etapa.PERDIDA, exigeMotivo: true, tipo: 'perda' },
    ]);
  });

  it('D-32 FORECAST → FECHAMENTO, FU (retorno), AO (retorno), PERDIDA', () => {
    expect(transicoesPermitidas(emEtapa(Etapa.FORECAST), HOJE)).toEqual([
      { para: Etapa.FECHAMENTO, exigeMotivo: false, tipo: 'avanco' },
      { para: Etapa.FOLLOW_UP, exigeMotivo: true, tipo: 'retorno' },
      { para: Etapa.APRESENTACAO_ORCAMENTO, exigeMotivo: true, tipo: 'retorno' },
      { para: Etapa.PERDIDA, exigeMotivo: true, tipo: 'perda' },
    ]);
  });

  it('D-33 finais não têm transições', () => {
    expect(transicoesPermitidas(emEtapa(Etapa.FECHAMENTO), HOJE)).toEqual([]);
    expect(transicoesPermitidas(emEtapa(Etapa.PERDIDA), HOJE)).toEqual([]);
  });

  it('D-34 transições estruturais seguem a matriz', () => {
    const destinos = (de: Etapa) => transicoesEstruturais(de).map((t) => `${t.para}:${t.tipo}:${t.exigeMotivo}`);
    expect(destinos(Etapa.PRIMEIRO_CONTATO)).toEqual(['APRESENTACAO_ORCAMENTO:avanco:false', 'PERDIDA:perda:true']);
    expect(destinos(Etapa.APRESENTACAO_ORCAMENTO)).toEqual(['FOLLOW_UP:avanco:false', 'PERDIDA:perda:true']);
    expect(destinos(Etapa.FOLLOW_UP)).toEqual([
      'FORECAST:avanco:false',
      'APRESENTACAO_ORCAMENTO:retorno:true',
      'PERDIDA:perda:true',
    ]);
    expect(destinos(Etapa.FORECAST)).toEqual([
      'FECHAMENTO:avanco:false',
      'FOLLOW_UP:retorno:true',
      'APRESENTACAO_ORCAMENTO:retorno:true',
      'PERDIDA:perda:true',
    ]);
    expect(destinos(Etapa.FECHAMENTO)).toEqual([]);
    expect(destinos(Etapa.PERDIDA)).toEqual([]);
  });

  it('D-34b toda transição estrutural é aceita por validarTransicao com dados completos e motivo', () => {
    for (const de of TODAS_AS_ETAPAS) {
      for (const para of TODAS_AS_ETAPAS) {
        const estrutural = transicoesEstruturais(de).some((t) => t.para === para);
        const r = validarTransicao(emEtapa(de), para, MOTIVO, HOJE);
        expect(r.ok, `${de} → ${para}`).toBe(estrutural);
      }
    }
  });

  it('motivoDeBloqueio explica destino inválido e ignora a exigência de motivo', () => {
    const op = emEtapa(Etapa.FOLLOW_UP, { validadeProposta: '2026-10-10' });
    expect(motivoDeBloqueio(op, Etapa.FECHAMENTO, HOJE)).toBe('Só é possível fechar uma oportunidade que esteja em Forecast.');
    expect(motivoDeBloqueio(op, Etapa.FORECAST, HOJE)).toContain('A proposta venceu em 10/10/2026');
    expect(motivoDeBloqueio(op, Etapa.PERDIDA, HOJE)).toBeNull();
    expect(motivoDeBloqueio(op, Etapa.APRESENTACAO_ORCAMENTO, HOJE)).toBeNull();
  });
});

describe('mensagens', () => {
  it('D-35 cada código tem mensagem em português com rótulos e datas interpolados', () => {
    const casos: Array<[OportunidadeDominio, Etapa, string | null]> = [
      [emEtapa(Etapa.FOLLOW_UP), Etapa.FOLLOW_UP, null],
      [emEtapa(Etapa.FECHAMENTO), Etapa.FORECAST, null],
      [emEtapa(Etapa.FOLLOW_UP), Etapa.PERDIDA, null],
      [emEtapa(Etapa.FOLLOW_UP), Etapa.APRESENTACAO_ORCAMENTO, null],
      [emEtapa(Etapa.FOLLOW_UP), Etapa.PRIMEIRO_CONTATO, MOTIVO],
      [emEtapa(Etapa.PRIMEIRO_CONTATO), Etapa.FOLLOW_UP, null],
      [emEtapa(Etapa.FOLLOW_UP), Etapa.FECHAMENTO, null],
      [opCompleta({ validadeProposta: null }), Etapa.APRESENTACAO_ORCAMENTO, null],
      [emEtapa(Etapa.FOLLOW_UP, { validadeProposta: '2026-10-13' }), Etapa.FORECAST, null],
    ];
    const mensagens = Object.fromEntries(
      casos.map(([op, para, motivo]) => {
        const r = validarTransicao(op, para, motivo, HOJE);
        if (r.ok) throw new Error(`esperava falha em ${op.etapa} → ${para}`);
        return [r.code, r.message];
      }),
    );
    expect(Object.keys(mensagens)).toHaveLength(Object.keys(C).length);
    expect(mensagens).toMatchInlineSnapshot(`
      {
        "ETAPA_FINAL": "Oportunidades em Fechamento ou Perdida não podem mudar de etapa.",
        "FECHAMENTO_SO_DE_FORECAST": "Só é possível fechar uma oportunidade que esteja em Forecast.",
        "MESMA_ETAPA": "A oportunidade já está nesta etapa.",
        "MOTIVO_PERDA_OBRIGATORIO": "Informe o motivo da perda para marcar a oportunidade como Perdida.",
        "MOTIVO_RETORNO_OBRIGATORIO": "Informe o motivo para retornar a oportunidade de etapa.",
        "PRE_CONDICAO_NAO_ATENDIDA": "Para apresentar o orçamento, informe: validade da proposta.",
        "PROPOSTA_VENCIDA": "A proposta venceu em 13/10/2026. Revise a proposta (volte para Apresentação de Orçamento) antes de colocar em Forecast.",
        "RETORNO_NAO_PERMITIDO": "Não é possível voltar para Primeiro Contato: uma proposta apresentada não volta a Primeiro Contato. Corrija os dados da oportunidade se necessário.",
        "SALTO_DE_ETAPA": "Avance uma etapa por vez: de Primeiro Contato a próxima etapa é Apresentação de Orçamento.",
      }
    `);
  });
});
