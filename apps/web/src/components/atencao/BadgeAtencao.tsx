'use client';

import { Etapa, TipoSinal, type Prioridade, type Severidade } from '@nobre/domain';
import {
  AlertTriangle,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Circle,
  Clock,
  FileQuestion,
  Trophy,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/primitivos';
import { Tooltip } from '@/components/ui/menu';
import type { OportunidadeResumo, SinalDTO } from '@/lib/api/tipos';
import { ESTILO_ETAPA, ESTILO_PRIORIDADE, ESTILO_SEVERIDADE, rotuloCurtoSinal } from '@/lib/apresentacao';
import { cn } from '@/lib/utils';

export const ICONE_SINAL: Record<TipoSinal, LucideIcon> = {
  EVENTO_PASSOU: AlertTriangle,
  EVENTO_PROXIMO: CalendarClock,
  PROPOSTA_VENCIDA: CalendarX,
  PROPOSTA_VENCE_EM_BREVE: CalendarClock,
  SEM_CONTATO: Clock,
  DADOS_INCOMPLETOS: FileQuestion,
};

export function IconeSeveridade({ severidade, className }: { severidade: Severidade | Prioridade; className?: string }) {
  const Icone = severidade === 'CRITICA' ? AlertTriangle : severidade === 'BAIXA' ? Circle : Clock;
  return <Icone aria-hidden className={cn('size-4 shrink-0', ESTILO_SEVERIDADE[severidade].texto, className)} />;
}

export function BadgeSinal({ sinal, op, hoje }: { sinal: SinalDTO; op: OportunidadeResumo; hoje: string }) {
  const estilo = ESTILO_SEVERIDADE[sinal.severidade];
  const Icone = ICONE_SINAL[sinal.tipo];
  return (
    <Tooltip conteudo={sinal.mensagem}>
      <Badge className={cn(estilo.fundo, estilo.texto)} aria-label={sinal.mensagem} tabIndex={-1}>
        <Icone aria-hidden />
        {rotuloCurtoSinal(sinal, op, hoje)}
      </Badge>
    </Tooltip>
  );
}

/** Até `max` badges visíveis; o resto vira "+N" com todas as mensagens no tooltip. */
export function BadgesAtencao({ op, hoje, max = 2 }: { op: OportunidadeResumo; hoje: string; max?: number }) {
  const sinais = op.atencao.sinais;
  if (sinais.length === 0) return null;
  const visiveis = sinais.slice(0, max);
  const resto = sinais.length - visiveis.length;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {visiveis.map((s) => (
        <BadgeSinal key={s.tipo} sinal={s} op={op} hoje={hoje} />
      ))}
      {resto > 0 && (
        <Tooltip
          conteudo={
            <ul className="space-y-0.5">
              {sinais.map((s) => (
                <li key={s.tipo}>• {s.mensagem}</li>
              ))}
            </ul>
          }
        >
          <Badge className="bg-slate-100 text-slate-700">+{resto}</Badge>
        </Tooltip>
      )}
    </div>
  );
}

export function BadgeSeveridade({ severidade }: { severidade: Severidade | null }) {
  if (!severidade) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700">
        <CheckCircle2 aria-hidden /> Em dia
      </Badge>
    );
  }
  const e = ESTILO_SEVERIDADE[severidade];
  return (
    <Badge className={cn(e.fundo, e.texto)}>
      <IconeSeveridade severidade={severidade} className="size-3" /> {e.rotulo}
    </Badge>
  );
}

export function BadgePrioridade({ prioridade }: { prioridade: Prioridade }) {
  const e = ESTILO_PRIORIDADE[prioridade];
  return (
    <Badge className={cn(e.fundo, e.texto, 'uppercase tracking-wide')}>
      <IconeSeveridade severidade={prioridade} className="size-3" /> {e.rotulo}
    </Badge>
  );
}

export function BadgeEtapa({ etapa, rotulo }: { etapa: Etapa; rotulo: string }) {
  const Icone = etapa === Etapa.FECHAMENTO ? Trophy : etapa === Etapa.PERDIDA ? XCircle : null;
  return (
    <Badge className={cn('ring-1', ESTILO_ETAPA[etapa])}>
      {Icone && <Icone aria-hidden />}
      {rotulo}
    </Badge>
  );
}
