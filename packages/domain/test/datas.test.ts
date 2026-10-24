import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  diasEntre,
  ehAnterior,
  ehDataCivilValida,
  formatarDataBR,
  hojeDataCivil,
  parseDataCivil,
  somarDias,
} from '../src';

describe('datas civis', () => {
  it('T-01 diasEntre conta dias inteiros e é negativo quando invertido', () => {
    expect(diasEntre('2026-10-06', '2026-10-15')).toBe(9);
    expect(diasEntre('2026-10-15', '2026-10-06')).toBe(-9);
    expect(diasEntre('2026-10-15', '2026-10-15')).toBe(0);
    // atravessa o fim do horário de verão / mudanças de fuso sem efeito (cálculo em UTC)
    expect(diasEntre('2026-02-01', '2026-03-01')).toBe(28);
    expect(ehAnterior('2026-10-14', '2026-10-15')).toBe(true);
    expect(ehAnterior('2026-10-15', '2026-10-15')).toBe(false);
  });

  it('T-02 parseDataCivil rejeita datas inexistentes e outros formatos', () => {
    for (const invalida of ['2026-02-31', '2026-13-01', '15/10/2026', '2026-1-5', '2026-10-15T00:00:00Z', '', '2026-00-10']) {
      expect(ehDataCivilValida(invalida), invalida).toBe(false);
      expect(() => parseDataCivil(invalida)).toThrow(RangeError);
    }
    expect(parseDataCivil('2028-02-29')).toEqual({ ano: 2028, mes: 2, dia: 29 });
    expect(ehDataCivilValida('2026-02-29')).toBe(false);
  });

  it('T-03 somarDias atravessa mês e ano', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(somarDias('2026-10-15', 0)).toBe('2026-10-15');
  });

  it('T-04 nada depende do fuso do processo: hojeDataCivil usa o fuso explícito', () => {
    // 15/10/2026 01:30 UTC ainda é 14/10 em São Paulo (UTC−3)
    const instante = new Date(Date.UTC(2026, 9, 15, 1, 30));
    expect(hojeDataCivil(instante, 'America/Sao_Paulo')).toBe('2026-10-14');
    expect(hojeDataCivil(instante, 'UTC')).toBe('2026-10-15');
    expect(formatarDataBR('2026-10-05')).toBe('05/10/2026');
  });

  it('T-04b o código do domínio nunca usa new Date(string) nem o relógio', () => {
    const pasta = join(import.meta.dirname, '..', 'src');
    for (const arquivo of readdirSync(pasta)) {
      const codigo = readFileSync(join(pasta, arquivo), 'utf8');
      expect(codigo, arquivo).not.toMatch(/new Date\(\s*['"`]/);
      expect(codigo, arquivo).not.toMatch(/Date\.now\(|new Date\(\)/);
    }
  });
});
