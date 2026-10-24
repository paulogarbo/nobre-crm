import { Etapa } from '@nobre/domain';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOrdenacaoLista } from '@/components/lista/useOrdenacaoLista';
import type { OportunidadeResumo } from '@/lib/api/tipos';

const op = (codigo: string, valorEstimado: number | null, empresa: string) =>
  ({ codigo, valorEstimado, empresa, etapa: Etapa.FOLLOW_UP }) as OportunidadeResumo;

describe('ordenação da lista', () => {
  const itens = [op('OPP-2003', 7200, 'Clínica Vida'), op('OPP-2002', 9800, 'Agência'), op('OPP-2010', null, 'Banco')];

  it('por prioridade mantém a ordem da API; valor começa do maior e alterna a direção', () => {
    const { result } = renderHook(() => useOrdenacaoLista(itens));
    expect(result.current.linhas.map((o) => o.codigo)).toEqual(['OPP-2003', 'OPP-2002', 'OPP-2010']);
    act(() => result.current.ordenarPor('valor'));
    expect(result.current.linhas.map((o) => o.codigo)).toEqual(['OPP-2002', 'OPP-2003', 'OPP-2010']);
    act(() => result.current.ordenarPor('valor'));
    expect(result.current.ordem).toEqual({ coluna: 'valor', direcao: 'asc' });
    expect(result.current.linhas.map((o) => o.codigo)).toEqual(['OPP-2010', 'OPP-2003', 'OPP-2002']);
  });

  it('texto ordena em pt-BR e código numericamente', () => {
    const { result } = renderHook(() => useOrdenacaoLista(itens));
    act(() => result.current.ordenarPor('empresa'));
    expect(result.current.linhas.map((o) => o.empresa)).toEqual(['Agência', 'Banco', 'Clínica Vida']);
    act(() => result.current.ordenarPor('codigo'));
    expect(result.current.linhas.map((o) => o.codigo)).toEqual(['OPP-2002', 'OPP-2003', 'OPP-2010']);
  });
});
