import { Etapa, type OportunidadeDominio } from '../src';

export const HOJE = '2026-10-15';

/** Oportunidade em Primeiro Contato com todos os dados para apresentar orçamento. */
export function opCompleta(overrides: Partial<OportunidadeDominio> = {}): OportunidadeDominio {
  return {
    id: 'op-1',
    codigo: 'OPP-9001',
    etapa: Etapa.PRIMEIRO_CONTATO,
    valorEstimado: 1000,
    itens: [{ descricao: 'Caneca personalizada', quantidade: 100, valorUnitario: null }],
    ultimoContato: HOJE,
    validadeProposta: '2026-10-30',
    eventoCliente: null,
    motivoPerda: null,
    ...overrides,
  };
}

/** Oportunidade "neutra" (sem nenhum gatilho de sinal ou ação) na etapa informada. */
export function opNeutra(etapa: Etapa, overrides: Partial<OportunidadeDominio> = {}): OportunidadeDominio {
  return opCompleta({ etapa, ultimoContato: HOJE, validadeProposta: '2026-12-31', eventoCliente: null, ...overrides });
}

const item = (descricao: string, quantidade: number) => [{ descricao, quantidade, valorUnitario: null }];

/** As 7 oportunidades do case, como o seed grava (espelho de apps/api/prisma/seed-data.ts). */
export const SEED: OportunidadeDominio[] = [
  {
    id: '2001', codigo: 'OPP-2001', etapa: Etapa.PRIMEIRO_CONTATO, valorEstimado: 4500,
    itens: item('Caneca personalizada', 300), ultimoContato: '2026-10-14', validadeProposta: null,
    eventoCliente: null, motivoPerda: null, criadaEm: '2026-10-14',
  },
  {
    id: '2002', codigo: 'OPP-2002', etapa: Etapa.APRESENTACAO_ORCAMENTO, valorEstimado: 9800,
    itens: item('Kit escritório', 120), ultimoContato: '2026-10-06', validadeProposta: '2026-10-13',
    eventoCliente: '2026-10-25', motivoPerda: null, criadaEm: '2026-09-29',
  },
  {
    id: '2003', codigo: 'OPP-2003', etapa: Etapa.FOLLOW_UP, valorEstimado: 7200,
    itens: item('Squeeze personalizado', 500), ultimoContato: '2026-10-13', validadeProposta: '2026-10-20',
    eventoCliente: '2026-10-18', motivoPerda: null, criadaEm: '2026-10-01',
  },
  {
    id: '2004', codigo: 'OPP-2004', etapa: Etapa.FOLLOW_UP, valorEstimado: 3900,
    itens: item('Camiseta estampada', 80), ultimoContato: '2026-10-02', validadeProposta: '2026-10-10',
    eventoCliente: '2026-11-05', motivoPerda: null, criadaEm: '2026-09-25',
  },
  {
    id: '2005', codigo: 'OPP-2005', etapa: Etapa.FORECAST, valorEstimado: 38000,
    itens: item('Agenda executiva', 1000), ultimoContato: '2026-10-15', validadeProposta: '2026-10-22',
    eventoCliente: '2026-12-12', motivoPerda: null, criadaEm: '2026-09-20',
  },
  {
    id: '2006', codigo: 'OPP-2006', etapa: Etapa.FECHAMENTO, valorEstimado: 11500,
    itens: item('Mochila infantil', 250), ultimoContato: '2026-10-09', validadeProposta: '2026-10-16',
    eventoCliente: '2026-10-17', motivoPerda: null, criadaEm: '2026-09-15',
  },
  {
    id: '2007', codigo: 'OPP-2007', etapa: Etapa.PERDIDA, valorEstimado: 350,
    itens: item('Caneta promocional', 50), ultimoContato: '2026-10-01', validadeProposta: '2026-10-08',
    eventoCliente: '2026-10-20',
    motivoPerda:
      'Proposta expirou sem retorno do cliente após tentativas de contato; ticket abaixo do mínimo operacional.',
    criadaEm: '2026-09-25',
  },
];
