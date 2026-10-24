import type { PrismaClient } from '../src/generated/prisma/client';
import { paraDataBancoOuNull } from '../src/lib/datas-banco';
import { oportunidadesRepository } from '../src/modules/oportunidades/oportunidades.repository';
import { OPORTUNIDADES, VENDEDORES } from './seed-data';

export interface ResultadoSeed {
  vendedores: number;
  oportunidades: number;
  itens: number;
  transicoes: number;
}

/**
 * Seed idempotente: upsert de vendedores (por e-mail) e oportunidades (por código); itens e
 * histórico dessas oportunidades são recriados do zero. Dos follow-ups, só os ABERTOS são apagados
 * (o motor recria no boot da API); os encerrados ficam como histórico do trabalho feito.
 */
export async function executarSeed(prisma: PrismaClient): Promise<ResultadoSeed> {
  const resultado: ResultadoSeed = { vendedores: 0, oportunidades: 0, itens: 0, transicoes: 0 };

  await prisma.$transaction(async (tx) => {
    const idPorEmail = new Map<string, string>();
    for (const v of VENDEDORES) {
      const vendedor = await tx.vendedor.upsert({
        where: { email: v.email },
        update: { nome: v.nome },
        create: { nome: v.nome, email: v.email },
      });
      idPorEmail.set(v.email, vendedor.id);
      resultado.vendedores++;
    }

    for (const o of OPORTUNIDADES) {
      const vendedorId = idPorEmail.get(o.vendedorEmail);
      if (!vendedorId) throw new Error(`Vendedor ${o.vendedorEmail} não está no seed`);

      const dados = {
        empresa: o.empresa,
        cnpj: null,
        contatoNome: null,
        contatoEmail: null,
        contatoTelefone: null,
        vendedorId,
        etapa: o.etapa,
        valorEstimado: o.valorEstimado,
        ultimoContato: paraDataBancoOuNull(o.ultimoContato),
        validadeProposta: paraDataBancoOuNull(o.validadeProposta),
        eventoCliente: paraDataBancoOuNull(o.eventoCliente),
        motivoPerda: o.motivoPerda,
        observacoes: null,
        atualizadoPorId: null,
        createdAt: new Date(o.createdAt),
      };
      const op = await tx.oportunidade.upsert({
        where: { codigo: o.codigo },
        update: dados,
        create: { codigo: o.codigo, ...dados },
      });

      await tx.itemBrinde.deleteMany({ where: { oportunidadeId: op.id } });
      await tx.transicaoEtapa.deleteMany({ where: { oportunidadeId: op.id } });
      await tx.followUp.deleteMany({ where: { oportunidadeId: op.id, status: 'ABERTO' } });

      await tx.itemBrinde.create({
        data: {
          oportunidadeId: op.id,
          descricao: o.item.descricao,
          quantidade: o.item.quantidade,
          valorUnitario: null,
          createdAt: new Date(o.createdAt),
        },
      });
      resultado.itens++;

      await tx.transicaoEtapa.createMany({
        data: o.transicoes.map((t) => ({
          oportunidadeId: op.id,
          deEtapa: t.de,
          paraEtapa: t.para,
          motivo: t.motivo,
          vendedorId, // executor = dono
          createdAt: new Date(t.em),
        })),
      });
      resultado.transicoes += o.transicoes.length;
      resultado.oportunidades++;
    }

    // Os códigos do case são gravados explicitamente: a sequência continua depois do maior.
    await oportunidadesRepository.sincronizarSequenciaDeCodigo(tx);
  });

  return resultado;
}

