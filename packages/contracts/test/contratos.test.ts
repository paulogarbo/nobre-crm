import { PRIORIDADES } from '@nobre/domain';
import { describe, expect, it } from 'vitest';
import { corpoCriar, corpoEditar, dataCivil, prioridade, queryListarOportunidades } from '../src';

describe('contrato HTTP', () => {
  it('datas civis inexistentes ou fora do formato são recusadas', () => {
    expect(dataCivil.safeParse('2026-10-15').success).toBe(true);
    expect(dataCivil.safeParse('2026-02-31').success).toBe(false);
    expect(dataCivil.safeParse('15/10/2026').success).toBe(false);
  });

  it('texto vazio vira null e campo desconhecido é recusado', () => {
    expect(corpoCriar.parse({ empresa: 'Hotel Atlântico', cnpj: '  ' }).cnpj).toBeNull();
    expect(corpoCriar.safeParse({ empresa: 'Hotel Atlântico', etapa: 'FECHAMENTO' }).success).toBe(false);
  });

  it('PATCH exige ao menos um campo', () => {
    expect(corpoEditar.safeParse({}).success).toBe(false);
    expect(corpoEditar.safeParse({ observacoes: null }).success).toBe(true);
  });

  it('prioridades vêm do domínio e a query converte etapas e booleanos', () => {
    expect(prioridade.options).toEqual([...PRIORIDADES]);
    expect(queryListarOportunidades.parse({ etapa: 'FORECAST, FECHAMENTO', atencao: 'true' })).toMatchObject({
      etapa: ['FORECAST', 'FECHAMENTO'],
      atencao: true,
      incluirFinais: true,
      ordem: 'prioridade',
    });
  });
});
