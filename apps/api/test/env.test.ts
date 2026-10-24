import { describe, expect, it } from 'vitest';
import { carregarEnv } from '../src/config/env';

const base = { DATABASE_URL: 'postgresql://u:s@localhost:5432/db' };

describe('variáveis de ambiente', () => {
  it('FOLLOWUP_CRON inválida falha no boot com mensagem clara', () => {
    expect(() => carregarEnv({ ...base, FOLLOWUP_CRON: 'toda hora' })).toThrow(/FOLLOWUP_CRON.*expressão cron válida/);
  });

  it('FOLLOWUP_CRON padrão e personalizada são aceitas', () => {
    expect(carregarEnv(base).FOLLOWUP_CRON).toBe('0 * * * *');
    expect(carregarEnv({ ...base, FOLLOWUP_CRON: '*/15 8-18 * * 1-5' }).FOLLOWUP_CRON).toBe('*/15 8-18 * * 1-5');
  });
});
