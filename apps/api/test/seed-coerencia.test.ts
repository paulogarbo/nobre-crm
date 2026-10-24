import { Etapa, avaliarAtencao, diasEntre, hojeDataCivil, validarTransicao, type OportunidadeDominio } from '@nobre/domain';
import { describe, expect, it } from 'vitest';
import { OPORTUNIDADES, VENDEDORES, type OportunidadeSeed } from '../prisma/seed-data';

const REFERENCIA = '2026-10-15';

function comoDominio(o: OportunidadeSeed, etapa: Etapa): OportunidadeDominio {
  return {
    id: o.codigo,
    codigo: o.codigo,
    etapa,
    valorEstimado: o.valorEstimado,
    itens: [{ ...o.item, valorUnitario: null }],
    ultimoContato: o.ultimoContato,
    validadeProposta: o.validadeProposta,
    eventoCliente: o.eventoCliente,
    motivoPerda: null,
  };
}

describe('coerência do seed com as regras do funil', () => {
  it('tem 3 vendedores, 7 oportunidades e 22 transições', () => {
    expect(VENDEDORES).toHaveLength(3);
    expect(OPORTUNIDADES).toHaveLength(7);
    expect(OPORTUNIDADES.flatMap((o) => o.transicoes)).toHaveLength(22);
  });

  it.each(OPORTUNIDADES.map((o) => [o.codigo, o] as const))(
    '%s: histórico reproduzido passo a passo por validarTransicao',
    (_codigo, o) => {
      const [criacao, ...passos] = o.transicoes;
      expect(criacao).toMatchObject({ de: null, para: Etapa.PRIMEIRO_CONTATO });
      expect(criacao!.em).toBe(o.createdAt);

      let etapa: Etapa = Etapa.PRIMEIRO_CONTATO;
      let anterior = criacao!.em;
      for (const t of passos) {
        expect(t.de, `${o.codigo}: transição deve partir da etapa atual`).toBe(etapa);
        expect(t.em > anterior, `${o.codigo}: histórico em ordem cronológica`).toBe(true);
        // "hoje" de cada passo é a data (em Brasília) em que ele aconteceu
        const hoje = hojeDataCivil(new Date(t.em));
        const r = validarTransicao(comoDominio(o, etapa), t.para, t.motivo, hoje);
        expect(r, `${o.codigo}: ${t.de} → ${t.para} em ${hoje}`).toEqual({ ok: true });
        etapa = t.para;
        anterior = t.em;
      }
      expect(etapa, `${o.codigo}: última transição leva à etapa atual`).toBe(o.etapa);
    },
  );

  it('nenhum contato registrado no futuro em relação à data de referência', () => {
    for (const o of OPORTUNIDADES) {
      if (o.ultimoContato) expect(diasEntre(o.ultimoContato, REFERENCIA)).toBeGreaterThanOrEqual(0);
    }
  });

  it('Perdida tem motivo, e o motivo do histórico é o mesmo da oportunidade', () => {
    for (const o of OPORTUNIDADES.filter((x) => x.etapa === Etapa.PERDIDA)) {
      expect(o.motivoPerda?.trim().length).toBeGreaterThanOrEqual(5);
      expect(o.transicoes.at(-1)?.motivo).toBe(o.motivoPerda);
    }
  });

  it('o seed produz a priorização esperada em 15/10/2026', () => {
    const scores = Object.fromEntries(
      OPORTUNIDADES.map((o) => [o.codigo, avaliarAtencao(comoDominio(o, o.etapa), REFERENCIA).score]),
    );
    expect(scores).toEqual({
      'OPP-2001': 12.25,
      'OPP-2002': 94.9,
      'OPP-2003': 103.6,
      'OPP-2004': 91.95,
      'OPP-2005': 0,
      'OPP-2006': 0,
      'OPP-2007': 0,
    });
  });
});
