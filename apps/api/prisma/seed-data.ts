/**
 * Dados do seed: as 7 oportunidades do case (data de referência 15/10/2026).
 * Exportados para que o teste de coerência reproduza o histórico pela máquina de estados.
 *
 * Campos que a tabela do case não traz (contato, CNPJ, valor unitário) ficam nulos de propósito:
 * não inventamos dados. O motivo de perda de OPP-2007 é obrigatório pela regra de negócio e foi
 * preenchido aqui (a tabela original não o trazia).
 */
import { Etapa } from '@nobre/domain';

export interface VendedorSeed {
  nome: string;
  email: string;
}

export interface TransicaoSeed {
  de: Etapa | null;
  para: Etapa;
  motivo: string | null;
  /** Instante ISO (UTC). 10:00 em Brasília = 13:00Z. */
  em: string;
}

export interface OportunidadeSeed {
  codigo: string;
  empresa: string;
  vendedorEmail: string;
  etapa: Etapa;
  valorEstimado: number;
  ultimoContato: string | null;
  validadeProposta: string | null;
  eventoCliente: string | null;
  motivoPerda: string | null;
  /** Instante ISO (UTC). 09:00 em Brasília = 12:00Z. */
  createdAt: string;
  item: { descricao: string; quantidade: number };
  transicoes: TransicaoSeed[];
}

export const VENDEDORES: VendedorSeed[] = [
  { nome: 'Ana', email: 'ana@nobrebrindes.com.br' },
  { nome: 'Bruno', email: 'bruno@nobrebrindes.com.br' },
  { nome: 'Carla', email: 'carla@nobrebrindes.com.br' },
];

export const MOTIVO_PERDA_OPP_2007 =
  'Proposta expirou sem retorno do cliente após tentativas de contato; ticket abaixo do mínimo operacional.';

const criada = (data: string) => `${data}T12:00:00.000Z`;
const as10h = (data: string) => `${data}T13:00:00.000Z`;

const { PRIMEIRO_CONTATO: PC, APRESENTACAO_ORCAMENTO: AO, FOLLOW_UP: FU, FORECAST: FC, FECHAMENTO, PERDIDA } = Etapa;

/** Criação: a linha de histórico "Criada em Primeiro Contato" tem o mesmo instante da oportunidade. */
const criacao = (data: string): TransicaoSeed => ({ de: null, para: PC, motivo: null, em: criada(data) });
const passo = (de: Etapa, para: Etapa, data: string, motivo: string | null = null): TransicaoSeed => ({
  de,
  para,
  motivo,
  em: as10h(data),
});

export const OPORTUNIDADES: OportunidadeSeed[] = [
  {
    codigo: 'OPP-2001',
    empresa: 'Tech Alpha Ltda',
    vendedorEmail: 'ana@nobrebrindes.com.br',
    etapa: PC,
    valorEstimado: 4500,
    ultimoContato: '2026-10-14',
    validadeProposta: null,
    eventoCliente: null,
    motivoPerda: null,
    createdAt: criada('2026-10-14'),
    item: { descricao: 'Caneca personalizada', quantidade: 300 },
    transicoes: [criacao('2026-10-14')],
  },
  {
    codigo: 'OPP-2002',
    empresa: 'Construtora Horizonte',
    vendedorEmail: 'bruno@nobrebrindes.com.br',
    etapa: AO,
    valorEstimado: 9800,
    ultimoContato: '2026-10-06',
    validadeProposta: '2026-10-13',
    eventoCliente: '2026-10-25',
    motivoPerda: null,
    createdAt: criada('2026-09-29'),
    item: { descricao: 'Kit escritório', quantidade: 120 },
    transicoes: [criacao('2026-09-29'), passo(PC, AO, '2026-10-06')],
  },
  {
    codigo: 'OPP-2003',
    empresa: 'Clínica Vida',
    vendedorEmail: 'ana@nobrebrindes.com.br',
    etapa: FU,
    valorEstimado: 7200,
    ultimoContato: '2026-10-13',
    validadeProposta: '2026-10-20',
    eventoCliente: '2026-10-18',
    motivoPerda: null,
    createdAt: criada('2026-10-01'),
    item: { descricao: 'Squeeze personalizado', quantidade: 500 },
    transicoes: [criacao('2026-10-01'), passo(PC, AO, '2026-10-06'), passo(AO, FU, '2026-10-13')],
  },
  {
    codigo: 'OPP-2004',
    empresa: 'Agência Pulso',
    vendedorEmail: 'carla@nobrebrindes.com.br',
    etapa: FU,
    valorEstimado: 3900,
    ultimoContato: '2026-10-02',
    validadeProposta: '2026-10-10',
    eventoCliente: '2026-11-05',
    motivoPerda: null,
    createdAt: criada('2026-09-25'),
    item: { descricao: 'Camiseta estampada', quantidade: 80 },
    transicoes: [criacao('2026-09-25'), passo(PC, AO, '2026-09-30'), passo(AO, FU, '2026-10-02')],
  },
  {
    codigo: 'OPP-2005',
    empresa: 'Banco Norte',
    vendedorEmail: 'bruno@nobrebrindes.com.br',
    etapa: FC,
    valorEstimado: 38000,
    ultimoContato: '2026-10-15',
    validadeProposta: '2026-10-22',
    eventoCliente: '2026-12-12',
    motivoPerda: null,
    createdAt: criada('2026-09-20'),
    item: { descricao: 'Agenda executiva', quantidade: 1000 },
    transicoes: [
      criacao('2026-09-20'),
      passo(PC, AO, '2026-10-01'),
      passo(AO, FU, '2026-10-08'),
      passo(FU, FC, '2026-10-15'),
    ],
  },
  {
    codigo: 'OPP-2006',
    empresa: 'Escola Saber',
    vendedorEmail: 'carla@nobrebrindes.com.br',
    etapa: FECHAMENTO,
    valorEstimado: 11500,
    ultimoContato: '2026-10-09',
    validadeProposta: '2026-10-16',
    eventoCliente: '2026-10-17',
    motivoPerda: null,
    createdAt: criada('2026-09-15'),
    item: { descricao: 'Mochila infantil', quantidade: 250 },
    transicoes: [
      criacao('2026-09-15'),
      passo(PC, AO, '2026-09-25'),
      passo(AO, FU, '2026-10-02'),
      passo(FU, FC, '2026-10-06'),
      passo(FC, FECHAMENTO, '2026-10-09'),
    ],
  },
  {
    codigo: 'OPP-2007',
    empresa: 'Padaria do Bairro',
    vendedorEmail: 'ana@nobrebrindes.com.br',
    etapa: PERDIDA,
    valorEstimado: 350,
    ultimoContato: '2026-10-01',
    validadeProposta: '2026-10-08',
    eventoCliente: '2026-10-20',
    motivoPerda: MOTIVO_PERDA_OPP_2007,
    createdAt: criada('2026-09-25'),
    item: { descricao: 'Caneta promocional', quantidade: 50 },
    transicoes: [
      criacao('2026-09-25'),
      passo(PC, AO, '2026-09-28'),
      passo(AO, FU, '2026-10-01'),
      passo(FU, PERDIDA, '2026-10-09', MOTIVO_PERDA_OPP_2007),
    ],
  },
];
