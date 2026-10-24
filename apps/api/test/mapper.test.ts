import { Etapa, TipoSinal, calcularSinais } from '@nobre/domain';
import { describe, expect, it } from 'vitest';
import { Prisma, type ItemBrinde, type Oportunidade } from '../src/generated/prisma/client';
import { paraDominio } from '../src/modules/oportunidades/oportunidades.mapper';

function oportunidade(createdAt: Date): Oportunidade & { itens: ItemBrinde[] } {
  return {
    id: '1', codigo: 'OPP-2100', empresa: 'Lead da Noite', cnpj: null, contatoNome: null, contatoEmail: null,
    contatoTelefone: null, vendedorId: 'v', etapa: Etapa.PRIMEIRO_CONTATO, valorEstimado: new Prisma.Decimal(1000),
    ultimoContato: null, validadeProposta: null, eventoCliente: null, motivoPerda: null, observacoes: null,
    createdAt, updatedAt: createdAt, itens: [],
  };
}

describe('mapper Prisma → domínio', () => {
  it('criadaEm usa a data de Brasília: criada às 22h30 de 13/10 (01:30Z de 14/10) conta desde 13/10', () => {
    const op = paraDominio(oportunidade(new Date('2026-10-14T01:30:00Z')));
    expect(op.criadaEm).toBe('2026-10-13');
    const sinal = calcularSinais(op, '2026-10-15').find((s) => s.tipo === TipoSinal.SEM_CONTATO);
    expect(sinal?.mensagem).toContain('2 dias');
  });

  it('durante o dia a data civil é a mesma em UTC e em Brasília', () => {
    expect(paraDominio(oportunidade(new Date('2026-10-14T15:00:00Z'))).criadaEm).toBe('2026-10-14');
  });
});
