import { Etapa } from '@nobre/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardOportunidade } from '@/components/kanban/CardOportunidade';
import { Contexto } from '@/components/oportunidade/AcoesOportunidade';
import { TooltipProvider } from '@/components/ui/menu';
import type { OportunidadeResumo } from '@/lib/api/tipos';

afterEach(cleanup);

const op: OportunidadeResumo = {
  id: '1', codigo: 'OPP-2001', empresa: 'Banco Horizonte', etapa: Etapa.PRIMEIRO_CONTATO, etapaRotulo: 'Primeiro Contato',
  vendedor: { id: 'a', nome: 'Ana' }, valorEstimado: 4500, itens: [], ultimoContato: '2026-10-13',
  validadeProposta: null, eventoCliente: null, diasSemContato: 2,
  atencao: { severidade: null, score: 0, sinais: [] }, proximaAcao: null, transicoesPermitidas: [],
  createdAt: '', updatedAt: '',
};

function renderizar() {
  const acoes = {
    solicitarMovimento: vi.fn(),
    explicarBloqueio: vi.fn(() => null),
    registrarContato: vi.fn(),
    abrirDetalhe: vi.fn(),
    abrirFormulario: vi.fn(),
  };
  render(
    <Contexto.Provider value={acoes}>
      <TooltipProvider>
        <CardOportunidade op={op} hoje="2026-10-15" />
      </TooltipProvider>
    </Contexto.Provider>,
  );
  return acoes;
}

describe('CardOportunidade (teclado)', () => {
  it('Enter no card abre o detalhe', () => {
    const acoes = renderizar();
    fireEvent.keyDown(screen.getByRole('button', { name: /OPP-2001, Banco Horizonte/ }), { key: 'Enter' });
    expect(acoes.abrirDetalhe).toHaveBeenCalledWith('1');
  });

  it('Enter em item do menu "⋯" executa só o item, sem abrir o detalhe', () => {
    const acoes = renderizar();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Ações de OPP-2001' }), { key: 'Enter' });
    const item = screen.getByRole('menuitem', { name: /Registrar contato hoje/ });
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(acoes.registrarContato).toHaveBeenCalledTimes(1);
    expect(acoes.abrirDetalhe).not.toHaveBeenCalled();
  });
});
