'use client';

import { ROTULOS_TIPO_FOLLOW_UP } from '@nobre/domain';
import { CheckCircle2 } from 'lucide-react';
import { BadgePrioridade, ICONE_SINAL } from '@/components/atencao/BadgeAtencao';
import { Button } from '@/components/ui/button';
import { useConcluirFollowUp } from '@/hooks/useFollowUps';
import type { FollowUpDaOportunidade, OportunidadeDetalhe } from '@/lib/api/tipos';
import { ESTILO_SEVERIDADE } from '@/lib/apresentacao';
import { data, dataHora, relativo } from '@/lib/formatadores';
import { cn } from '@/lib/utils';
import { Secao } from './Secao';

const STATUS_FOLLOW_UP: Record<FollowUpDaOportunidade['status'], string> = {
  ABERTO: 'Aberto',
  CONCLUIDO: 'Concluído pelo vendedor',
  RESOLVIDO: 'Resolvido automaticamente',
  SUBSTITUIDO: 'Substituído por ação mais urgente',
};

/** Sinais de atenção, do mais grave ao menos grave (ou "tudo em dia"). */
export function SecaoAtencao({ op }: { op: OportunidadeDetalhe }) {
  return (
    <Secao titulo="Atenção">
      {op.atencao.sinais.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" aria-hidden /> Nenhum alerta. Tudo em dia.
        </p>
      ) : (
        <ul className="space-y-2">
          {op.atencao.sinais.map((s) => {
            const Icone = ICONE_SINAL[s.tipo];
            const e = ESTILO_SEVERIDADE[s.severidade];
            return (
              <li
                key={s.tipo}
                className={cn('flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm', e.fundo)}
              >
                <Icone className={cn('mt-0.5 size-4 shrink-0', e.texto)} aria-hidden />
                <span className="text-slate-800">{s.mensagem}</span>
                <span className={cn('ml-auto text-xs font-medium', e.texto)}>{e.rotulo}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}

/** A ação aberta da oportunidade, com o botão de concluir. */
export function SecaoProximaAcao({ aberto, hoje }: { aberto: FollowUpDaOportunidade; hoje: string }) {
  const concluir = useConcluirFollowUp();
  return (
    <Secao titulo="Próxima ação" className="border-sky-200 bg-sky-50/50">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <BadgePrioridade prioridade={aberto.prioridade} />
            <p className="font-medium text-slate-900">{aberto.titulo}</p>
          </div>
          <p className="text-sm text-slate-700">{aberto.descricao}</p>
          <p className="text-xs text-slate-500">
            Prazo: {data(aberto.venceEm)} ({relativo(aberto.venceEm, hoje)}) ·{' '}
            {ROTULOS_TIPO_FOLLOW_UP[aberto.tipo]}
          </p>
        </div>
        <Button size="sm" disabled={concluir.isPending} onClick={() => concluir.mutate(aberto.id)}>
          <CheckCircle2 /> Concluir (registra contato)
        </Button>
      </div>
    </Secao>
  );
}

/** Ações já encerradas (concluídas, resolvidas ou substituídas), recolhidas por padrão. */
export function FollowUpsAnteriores({ anteriores }: { anteriores: FollowUpDaOportunidade[] }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
        Follow-ups anteriores ({anteriores.length})
      </summary>
      <ul className="mt-3 space-y-2">
        {anteriores.map((f) => (
          <li key={f.id} className="text-sm">
            <span className="font-medium text-slate-800">{f.titulo}</span>
            <span className="block text-xs text-slate-500">
              {f.concluidoPor ? `Concluído por ${f.concluidoPor.nome}` : STATUS_FOLLOW_UP[f.status]} · criado
              em {dataHora(f.criadoEm)}
              {f.encerradoEm ? ` · encerrado em ${dataHora(f.encerradoEm)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
