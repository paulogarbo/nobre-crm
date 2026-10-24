'use client';

import { PRIORIDADES, ROTULOS_TIPO_FOLLOW_UP, diasEntre, type Prioridade } from '@nobre/domain';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { IconeSeveridade } from '@/components/atencao/BadgeAtencao';
import { useAcoesOportunidade } from '@/components/oportunidade/AcoesOportunidade';
import { Button } from '@/components/ui/button';
import { useConcluirFollowUp } from '@/hooks/useFollowUps';
import type { FollowUpDTO } from '@/lib/api/tipos';
import { ESTILO_PRIORIDADE } from '@/lib/apresentacao';
import { moeda } from '@/lib/formatadores';
import { cn } from '@/lib/utils';

const TITULO_GRUPO: Record<Prioridade, string> = { CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Média' };

export function ItemFollowUp({ f, hoje }: { f: FollowUpDTO; hoje: string }) {
  const { abrirDetalhe } = useAcoesOportunidade();
  const concluir = useConcluirFollowUp();
  const atraso = diasEntre(f.venceEm, hoje);
  const estilo = ESTILO_PRIORIDADE[f.prioridade];

  return (
    <li className={cn('rounded-lg border border-slate-200 border-l-[3px] bg-white p-4 shadow-sm', estilo.borda)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <IconeSeveridade severidade={f.prioridade} />
            <p className="font-semibold text-slate-900">{f.titulo}</p>
            {f.atrasado && (
              <span className="rounded bg-red-50 px-1.5 text-xs font-medium text-red-700">
                venceu há {atraso} dia{atraso === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-[13px] text-slate-600">
            <span className="font-mono text-xs">{f.oportunidade.codigo}</span> · {f.oportunidade.empresa} ·{' '}
            {f.oportunidade.etapaRotulo} · {moeda(f.oportunidade.valorEstimado)}
          </p>
          <p className="text-sm text-slate-800">{f.descricao}</p>
          <p className="text-xs text-slate-500">{ROTULOS_TIPO_FOLLOW_UP[f.tipo]}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => abrirDetalhe(f.oportunidade.id)}>
            <ExternalLink /> Abrir oportunidade
          </Button>
          <Button size="sm" disabled={concluir.isPending} onClick={() => concluir.mutate(f.id)}>
            <CheckCircle2 /> Concluir (registra contato)
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Ações agrupadas por prioridade (a API já entrega ordenado: prioridade, prazo, valor). */
export function ListaFollowUps({ itens, hoje }: { itens: FollowUpDTO[]; hoje: string }) {
  return (
    <div className="flex flex-col gap-6">
      {PRIORIDADES.map((p) => {
        const doGrupo = itens.filter((f) => f.prioridade === p);
        if (doGrupo.length === 0) return null;
        return (
          <section key={p} aria-labelledby={`grupo-${p}`}>
            <h2 id={`grupo-${p}`} className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <IconeSeveridade severidade={p} /> Prioridade {TITULO_GRUPO[p].toLowerCase()} · {doGrupo.length}
            </h2>
            <ul className="flex flex-col gap-2">
              {doGrupo.map((f) => (
                <ItemFollowUp key={f.id} f={f} hoje={hoje} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
