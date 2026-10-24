'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLUNAS, type Coluna, type Ordem } from './useOrdenacaoLista';

/** Cabeçalho da tabela: cada coluna ordenável anuncia a direção atual (aria-sort). */
export function CabecalhoLista({
  ordem,
  ordenarPor,
}: {
  ordem: Ordem;
  ordenarPor: (coluna: Coluna) => void;
}) {
  return (
    <thead className="bg-slate-50 text-left text-xs text-slate-600">
      <tr>
        {COLUNAS.map((c) => {
          const ativa = ordem.coluna === c.chave;
          const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
          return (
            <th
              key={c.chave}
              scope="col"
              className={cn('px-3 py-2 font-medium', c.classe)}
              aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type="button"
                onClick={() => ordenarPor(c.chave)}
                className="inline-flex items-center gap-1 hover:text-slate-900"
              >
                {c.rotulo}
                <Icone className={cn('size-3', !ativa && 'opacity-40')} aria-hidden />
              </button>
            </th>
          );
        })}
        <th scope="col" className="px-3 py-2 font-medium">
          Próxima ação
        </th>
        <th scope="col" className="w-10 px-3 py-2">
          <span className="sr-only">Ações</span>
        </th>
      </tr>
    </thead>
  );
}
