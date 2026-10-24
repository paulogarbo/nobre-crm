import { Etapa, ROTULOS, ehRetorno } from '@nobre/domain';
import { ArrowRight, Plus, Trophy, Undo2, XCircle, type LucideIcon } from 'lucide-react';
import type { HistoricoDTO } from '@/lib/api/tipos';
import { dataHora } from '@/lib/formatadores';
import { cn } from '@/lib/utils';

function aparencia(h: HistoricoDTO): { Icone: LucideIcon; cor: string; texto: string } {
  if (h.deEtapa === null) return { Icone: Plus, cor: 'bg-sky-100 text-sky-700', texto: `Criada em ${ROTULOS[h.paraEtapa]}` };
  const texto = `De ${ROTULOS[h.deEtapa]} para ${ROTULOS[h.paraEtapa]}`;
  if (h.paraEtapa === Etapa.PERDIDA) return { Icone: XCircle, cor: 'bg-red-100 text-red-700', texto };
  if (h.paraEtapa === Etapa.FECHAMENTO) return { Icone: Trophy, cor: 'bg-emerald-100 text-emerald-700', texto };
  if (ehRetorno(h.deEtapa, h.paraEtapa)) return { Icone: Undo2, cor: 'bg-amber-100 text-amber-800', texto: `${texto} (retorno)` };
  return { Icone: ArrowRight, cor: 'bg-slate-200 text-slate-700', texto };
}

/** Linha do tempo das mudanças de etapa: mais recente em cima (quando, de → para, motivo, quem). */
export function TimelineHistorico({ historico }: { historico: HistoricoDTO[] }) {
  const itens = [...historico].reverse();
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-6" aria-label="Histórico de etapas">
      {itens.map((h) => {
        const { Icone, cor, texto } = aparencia(h);
        return (
          <li key={h.id} className="relative">
            <span className={cn('absolute -left-[37px] top-0 flex size-6 items-center justify-center rounded-full ring-4 ring-slate-50', cor)}>
              <Icone className="size-3.5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-slate-800">{texto}</p>
            <p className="text-xs text-slate-500">
              <time dateTime={h.createdAt}>{dataHora(h.createdAt)}</time> · por {h.vendedor.nome}
            </p>
            {h.motivo && <p className="mt-1 text-[13px] italic text-slate-600">“{h.motivo}”</p>}
          </li>
        );
      })}
    </ol>
  );
}
