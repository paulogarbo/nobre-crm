'use client';

import { TODAS_AS_ETAPAS, compararCodigo } from '@nobre/domain';
import { useMemo, useState } from 'react';
import type { OportunidadeResumo } from '@/lib/api/tipos';

export type Coluna =
  | 'prioridade'
  | 'codigo'
  | 'empresa'
  | 'etapa'
  | 'vendedor'
  | 'valor'
  | 'ultimoContato'
  | 'validade'
  | 'evento';

export const COLUNAS: Array<{ chave: Coluna; rotulo: string; classe?: string }> = [
  { chave: 'codigo', rotulo: 'Código' },
  { chave: 'empresa', rotulo: 'Empresa' },
  { chave: 'etapa', rotulo: 'Etapa' },
  { chave: 'vendedor', rotulo: 'Vendedor' },
  { chave: 'valor', rotulo: 'Valor', classe: 'text-right' },
  { chave: 'ultimoContato', rotulo: 'Último contato' },
  { chave: 'validade', rotulo: 'Validade' },
  { chave: 'evento', rotulo: 'Evento' },
  { chave: 'prioridade', rotulo: 'Atenção' },
];

// Ordenação por coluna no cliente, sobre o resultado já carregado (a API entrega por prioridade).
const comparadores: Record<Coluna, (a: OportunidadeResumo, b: OportunidadeResumo) => number> = {
  prioridade: () => 0,
  codigo: (a, b) => compararCodigo(a.codigo, b.codigo),
  empresa: (a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'),
  etapa: (a, b) => TODAS_AS_ETAPAS.indexOf(a.etapa) - TODAS_AS_ETAPAS.indexOf(b.etapa),
  vendedor: (a, b) => a.vendedor.nome.localeCompare(b.vendedor.nome, 'pt-BR'),
  valor: (a, b) => (a.valorEstimado ?? 0) - (b.valorEstimado ?? 0),
  ultimoContato: (a, b) => (a.ultimoContato ?? '').localeCompare(b.ultimoContato ?? ''),
  validade: (a, b) => (a.validadeProposta ?? '9999').localeCompare(b.validadeProposta ?? '9999'),
  evento: (a, b) => (a.eventoCliente ?? '9999').localeCompare(b.eventoCliente ?? '9999'),
};

export interface Ordem {
  coluna: Coluna;
  direcao: 'asc' | 'desc';
}

/** Ordem escolhida no cabeçalho e as linhas já ordenadas (por prioridade, mantém a ordem da API). */
export function useOrdenacaoLista(itens: OportunidadeResumo[]) {
  const [ordem, setOrdem] = useState<Ordem>({ coluna: 'prioridade', direcao: 'asc' });

  const linhas = useMemo(() => {
    if (ordem.coluna === 'prioridade') return itens;
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    return [...itens].sort(
      (a, b) => sinal * comparadores[ordem.coluna](a, b) || compararCodigo(a.codigo, b.codigo),
    );
  }, [itens, ordem]);

  function ordenarPor(coluna: Coluna) {
    setOrdem((o) =>
      o.coluna === coluna
        ? { coluna, direcao: o.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna, direcao: coluna === 'valor' ? 'desc' : 'asc' },
    );
  }

  return { ordem, linhas, ordenarPor };
}
