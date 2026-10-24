import { Etapa, SEVERIDADES, TipoFollowUp, TipoSinal, ehDataCivilValida, ehEtapa } from '@nobre/domain';
import { z } from 'zod';

// ---------- blocos reutilizáveis ----------

export const dataCivil = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato YYYY-MM-DD')
  .refine(ehDataCivilValida, 'data inexistente');

/** Campos de texto opcionais: string vazia vira `null` ("não informado"). */
const vazioParaNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const textoOpcional = (max: number) => z.preprocess(vazioParaNull, z.string().trim().max(max).nullable().optional());

const itemEntrada = z.strictObject({
  descricao: z.string().trim().min(2, 'descreva o item (mínimo 2 caracteres)').max(200),
  quantidade: z.number().int('quantidade deve ser inteira').positive('quantidade deve ser maior que zero').max(10_000_000),
  valorUnitario: z.number().min(0, 'valor unitário não pode ser negativo').max(9_999_999_999).nullable().optional(),
});

const camposOportunidade = {
  vendedorId: z.uuid('vendedorId inválido').optional(),
  cnpj: textoOpcional(20),
  contatoNome: textoOpcional(200),
  contatoEmail: z.preprocess(vazioParaNull, z.email('e-mail inválido').max(200).nullable().optional()),
  contatoTelefone: textoOpcional(30),
  valorEstimado: z.number().min(0, 'valor estimado não pode ser negativo').max(9_999_999_999).nullable().optional(),
  ultimoContato: z.preprocess(vazioParaNull, dataCivil.nullable().optional()),
  validadeProposta: z.preprocess(vazioParaNull, dataCivil.nullable().optional()),
  eventoCliente: z.preprocess(vazioParaNull, dataCivil.nullable().optional()),
  observacoes: textoOpcional(2000),
  itens: z.array(itemEntrada).max(50).optional(),
};

const empresa = z.string().trim().min(2, 'informe o nome da empresa (mínimo 2 caracteres)').max(200);

// ---------- entrada ----------

export const corpoCriar = z.strictObject({ empresa, ...camposOportunidade });
export type CorpoCriar = z.infer<typeof corpoCriar>;

/** PATCH: qualquer subconjunto dos campos do POST; `null` limpa o campo; `itens` substitui a lista. */
export const corpoEditar = z.strictObject({ empresa: empresa.optional(), ...camposOportunidade });
export type CorpoEditar = z.infer<typeof corpoEditar>;

export const corpoTransicao = z.strictObject({
  para: z.enum(Etapa, 'etapa de destino inválida'),
  motivo: z.string().trim().max(2000).nullable().optional(),
});

export const corpoContato = z
  .strictObject({
    data: dataCivil.optional(),
    observacao: z.string().trim().min(1).max(2000).optional(),
  })
  .nullish(); // sem corpo, o Fastify entrega `null`

export const paramsId = z.object({ id: z.string().trim().min(1).max(100) });

const booleanoTexto = z.enum(['true', 'false']).transform((v) => v === 'true');

export const ORDENS = ['prioridade', 'valor', 'ultimoContato', 'codigo'] as const;
export type Ordem = (typeof ORDENS)[number];

export const queryListar = z.object({
  q: z.preprocess(vazioParaNull, z.string().trim().min(1).max(100).nullable().optional()),
  etapa: z
    .string()
    .transform((v) => v.split(',').map((e) => e.trim()).filter(Boolean))
    .refine((lista) => lista.every(ehEtapa), 'etapa inválida')
    .transform((lista) => lista as Etapa[])
    .optional(),
  vendedorId: z.uuid('vendedorId inválido').optional(),
  atencao: booleanoTexto.optional(),
  severidade: z.enum(SEVERIDADES).optional(),
  incluirFinais: booleanoTexto.default(true),
  ordem: z.enum(ORDENS).default('prioridade'),
});
export type QueryListar = z.infer<typeof queryListar>;

// ---------- respostas (a API só devolve o que está declarado aqui) ----------

const etapa = z.enum(Etapa);
const severidade = z.enum(SEVERIDADES);
const prioridade = z.enum(['CRITICA', 'ALTA', 'MEDIA']);
const statusFollowUp = z.enum(['ABERTO', 'CONCLUIDO', 'RESOLVIDO', 'SUBSTITUIDO']);
const vendedorRef = z.object({ id: z.string(), nome: z.string() });

export const itemSaida = z.object({
  id: z.string(),
  descricao: z.string(),
  quantidade: z.number(),
  valorUnitario: z.number().nullable(),
});

export const transicaoPermitidaSaida = z.object({
  para: etapa,
  exigeMotivo: z.boolean(),
  tipo: z.enum(['avanco', 'retorno', 'perda']),
});

export const oportunidadeResumo = z.object({
  id: z.string(),
  codigo: z.string(),
  empresa: z.string(),
  etapa,
  etapaRotulo: z.string(),
  vendedor: vendedorRef,
  valorEstimado: z.number().nullable(),
  itens: z.array(itemSaida),
  ultimoContato: z.string().nullable(),
  validadeProposta: z.string().nullable(),
  eventoCliente: z.string().nullable(),
  diasSemContato: z.number().nullable(),
  atencao: z.object({
    severidade: severidade.nullable(),
    score: z.number(),
    sinais: z.array(z.object({ tipo: z.enum(TipoSinal), severidade, mensagem: z.string() })),
  }),
  proximaAcao: z
    .object({
      id: z.string(),
      tipo: z.enum(TipoFollowUp),
      prioridade,
      titulo: z.string(),
      venceEm: z.string(),
    })
    .nullable(),
  transicoesPermitidas: z.array(transicaoPermitidaSaida),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OportunidadeResumoDTO = z.infer<typeof oportunidadeResumo>;

export const historicoSaida = z.object({
  id: z.string(),
  deEtapa: etapa.nullable(),
  paraEtapa: etapa,
  motivo: z.string().nullable(),
  vendedor: vendedorRef,
  createdAt: z.string(),
});
export type HistoricoDTO = z.infer<typeof historicoSaida>;

export const followUpDaOportunidade = z.object({
  id: z.string(),
  tipo: z.enum(TipoFollowUp),
  prioridade,
  titulo: z.string(),
  descricao: z.string(),
  venceEm: z.string(),
  status: statusFollowUp,
  criadoEm: z.string(),
  encerradoEm: z.string().nullable(),
});
export type FollowUpDaOportunidadeDTO = z.infer<typeof followUpDaOportunidade>;

export const oportunidadeDetalhe = oportunidadeResumo.extend({
  cnpj: z.string().nullable(),
  contatoNome: z.string().nullable(),
  contatoEmail: z.string().nullable(),
  contatoTelefone: z.string().nullable(),
  motivoPerda: z.string().nullable(),
  observacoes: z.string().nullable(),
  historico: z.array(historicoSaida),
  followUps: z.array(followUpDaOportunidade),
});
export type OportunidadeDetalheDTO = z.infer<typeof oportunidadeDetalhe>;

export const respostaListagem = z.object({
  hoje: z.string(),
  total: z.number(),
  itens: z.array(oportunidadeResumo),
});

export const respostaHistorico = z.object({ itens: z.array(historicoSaida) });
