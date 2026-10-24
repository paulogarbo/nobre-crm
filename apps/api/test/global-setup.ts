import { execSync } from 'node:child_process';
import pg from 'pg';

/**
 * Prepara o banco de testes uma vez por execução: recusa qualquer URL sem `_test` (nunca tocar no
 * banco de desenvolvimento), cria o banco se não existir e aplica as migrations.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? '';
  const nomeBanco = new URL(url).pathname.slice(1);
  if (!nomeBanco.endsWith('_test')) {
    throw new Error(`Recusando rodar testes contra "${nomeBanco}": o DATABASE_URL de teste precisa terminar em _test.`);
  }

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const cliente = new pg.Client({ connectionString: admin.toString() });
  try {
    await cliente.connect();
  } catch (erro) {
    throw new Error(
      `Não foi possível conectar ao Postgres de teste (${admin.host}). Rode "docker compose up -d postgres" antes de "pnpm test".\n${String(erro)}`,
    );
  }
  try {
    const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco]);
    if (existe.rowCount === 0) await cliente.query(`CREATE DATABASE "${nomeBanco.replace(/"/g, '')}"`);
  } finally {
    await cliente.end();
  }

  try {
    execSync('pnpm exec prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } });
  } catch (erro) {
    const saida = (erro as { stderr?: Buffer; stdout?: Buffer }).stderr?.toString() ?? String(erro);
    throw new Error(`Falha ao aplicar migrations no banco de teste:
${saida}`);
  }
}
