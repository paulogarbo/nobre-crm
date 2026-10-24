'use client';

import { AlertCircle, Inbox, RefreshCw, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitivos';
import { mensagemDeErro } from '@/lib/api/client';

function Caixa({ icone, titulo, children }: { icone: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="rounded-full bg-slate-100 p-3 text-slate-500">{icone}</div>
      <p className="text-base font-semibold text-slate-800">{titulo}</p>
      {children}
    </div>
  );
}

export function Erro({ erro, onTentarNovamente, titulo }: { erro: unknown; onTentarNovamente: () => void; titulo?: string }) {
  return (
    <div role="alert">
      <Caixa icone={<AlertCircle className="size-6 text-red-600" />} titulo={titulo ?? 'Não foi possível carregar as oportunidades.'}>
        <p className="max-w-md text-xs text-slate-500">{mensagemDeErro(erro)}</p>
        <Button onClick={onTentarNovamente}>
          <RefreshCw /> Tentar novamente
        </Button>
      </Caixa>
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <Caixa icone={<Inbox className="size-6" />} titulo={titulo}>
      {children}
    </Caixa>
  );
}

export function SemResultados({ onLimpar }: { onLimpar: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
      <SearchX className="size-4 text-slate-500" aria-hidden />
      <span className="text-slate-700">Nenhuma oportunidade para esses filtros.</span>
      <Button variant="outline" size="xs" onClick={onLimpar}>
        Limpar filtros
      </Button>
    </div>
  );
}

/** 6 colunas com 3 skeletons de card cada. */
export function CarregandoBoard() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-busy="true" aria-label="Carregando oportunidades">
      {Array.from({ length: 6 }, (_, c) => (
        <div key={c} className="flex w-[280px] min-w-[280px] flex-col gap-3 rounded-xl bg-slate-200/50 p-3">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CarregandoLista({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full bg-white" />
      ))}
    </div>
  );
}
