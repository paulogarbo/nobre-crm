'use client';

import { useDroppable } from '@dnd-kit/core';
import { SEVERIDADES, type Etapa } from '@nobre/domain';
import { Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { ESTILO_SEVERIDADE } from '@/lib/apresentacao';
import { moedaCompacta } from '@/lib/formatadores';
import { cn } from '@/lib/utils';
import { CardOportunidade } from './CardOportunidade';

/** Como a coluna se apresenta durante um arrasto. */
export type EstadoDestino =
  | { tipo: 'origem' }
  | { tipo: 'valido'; exigeMotivo: boolean }
  | { tipo: 'invalido'; motivo: string };

interface Props {
  etapa: Etapa;
  rotulo: string;
  itens: OportunidadeResumo[];
  hoje: string;
  destino: EstadoDestino | null;
  colapsavel?: boolean;
  colapsada?: boolean;
  onAlternarColapso?: () => void;
}

export function KanbanColuna({ etapa, rotulo, itens, hoje, destino, colapsavel, colapsada, onAlternarColapso }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  const soma = itens.reduce((t, i) => t + (i.valorEstimado ?? 0), 0);
  const maisGrave = SEVERIDADES.find((s) => itens.some((i) => i.atencao.severidade === s));
  const invalido = destino?.tipo === 'invalido';
  const valido = destino?.tipo === 'valido';

  if (colapsada) {
    return (
      <section
        ref={setNodeRef}
        aria-label={`${rotulo}: ${itens.length} oportunidade(s), coluna recolhida`}
        className={cn(
          'flex w-12 min-w-12 flex-col items-center gap-2 rounded-xl bg-slate-200/60 py-3 transition',
          valido && 'border-2 border-dashed border-sky-500 bg-sky-50',
          valido && isOver && 'bg-sky-100',
          invalido && 'cursor-not-allowed opacity-40',
        )}
      >
        <button
          type="button"
          onClick={onAlternarColapso}
          className="flex flex-col items-center gap-2 rounded-md px-1 py-1 text-slate-600 hover:bg-slate-300/60"
          aria-label={`Expandir coluna ${rotulo}`}
          aria-expanded={false}
        >
          <ChevronRight className="size-4" />
          <span className="rounded-full bg-white px-1.5 text-xs font-semibold text-slate-700">{itens.length}</span>
          <span className="text-xs font-semibold text-slate-700 [writing-mode:vertical-rl]">{rotulo}</span>
        </button>
        {valido && destino.exigeMotivo && (
          <span className="text-[10px] font-medium text-amber-800 [writing-mode:vertical-rl]">pede motivo</span>
        )}
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={`${rotulo}: ${itens.length} oportunidade(s)`}
      className={cn(
        'flex w-[280px] min-w-[280px] flex-col rounded-xl border-2 border-transparent bg-slate-200/60 transition',
        valido && 'border-dashed border-sky-500 bg-sky-50/60',
        valido && isOver && 'bg-sky-100/80',
        invalido && 'cursor-not-allowed opacity-40',
      )}
    >
      <header className="px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          {maisGrave && (
            <span
              className={cn('size-2 shrink-0 rounded-full', ESTILO_SEVERIDADE[maisGrave].ponto)}
              title={`Atenção mais grave nesta coluna: ${ESTILO_SEVERIDADE[maisGrave].rotulo}`}
            />
          )}
          <h2 className="text-[13px] font-semibold leading-tight text-slate-800">{rotulo}</h2>
          <span className="rounded-full bg-white px-1.5 text-xs font-semibold text-slate-600">{itens.length}</span>
          <span className="ml-auto whitespace-nowrap text-xs text-slate-500" title="Soma do valor estimado">{moedaCompacta(soma)}</span>
          {colapsavel && (
            <button
              type="button"
              onClick={onAlternarColapso}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-300/60"
              aria-label={`Recolher coluna ${rotulo}`}
              aria-expanded
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
        </div>
        {valido && (
          <p className="mt-1 text-[11px] font-medium text-sky-800">
            Solte aqui{destino.exigeMotivo ? ' · pede motivo' : ''}
          </p>
        )}
        {invalido && (
          <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-slate-700">
            <Ban className="mt-px size-3 shrink-0" aria-hidden />
            <span className="line-clamp-3">{destino.motivo}</span>
          </p>
        )}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 lg:max-h-[calc(100vh-245px)]">
        {itens.map((op) => (
          <CardOportunidade key={op.id} op={op} hoje={hoje} />
        ))}
        {itens.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
            Nenhuma oportunidade
          </p>
        )}
      </div>
    </section>
  );
}
