import { ehDataCivilValida } from '@nobre/domain';
import cron from 'node-cron';
import { z } from 'zod';

const vazioParaUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const esquemaEnv = z.object({
  DATABASE_URL: z.string({ error: 'DATABASE_URL é obrigatória' }).min(1, 'DATABASE_URL é obrigatória'),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  REFERENCE_DATE: z.preprocess(
    vazioParaUndefined,
    z
      .string()
      .refine(ehDataCivilValida, 'REFERENCE_DATE precisa estar no formato YYYY-MM-DD e ser uma data real')
      .optional(),
  ),
  // Validada aqui para falhar no boot, antes do listen, e não depois com a API já no ar.
  FOLLOWUP_CRON: z
    .string()
    .default('0 * * * *')
    .refine((expressao) => cron.validate(expressao), 'FOLLOWUP_CRON precisa ser uma expressão cron válida (ex.: 0 * * * *)'),
  FOLLOWUP_WEBHOOK_URL: z.preprocess(vazioParaUndefined, z.url('FOLLOWUP_WEBHOOK_URL inválida').optional()),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof esquemaEnv>;

/** Valida as variáveis de ambiente e falha no boot com uma mensagem clara. */
export function carregarEnv(fonte: NodeJS.ProcessEnv = process.env): Env {
  const resultado = esquemaEnv.safeParse(fonte);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`);
    throw new Error(`Configuração inválida:\n${problemas.join('\n')}\nVeja apps/api/.env.example.`);
  }
  return resultado.data;
}
