'use client';

import { ehFinal } from '@nobre/domain';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OportunidadeResumo } from '@/lib/api/tipos';

function plural(n: number, singular: string, pluralForma: string) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/**
 * Resposta direta para "o que eu trabalho hoje?". Conta como "precisa de atenção" o que tem sinal
 * crítico, alto ou médio; dado incompleto (baixa) aparece à parte, porque não é urgência.
 */
export function ResumoAtencao({
  itens,
  filtroAtivo,
  onAlternarFiltro,
}: {
  itens: OportunidadeResumo[];
  filtroAtivo: boolean;
  onAlternarFiltro: (ativo: boolean) => void;
}) {
  const ativos = itens.filter((i) => !ehFinal(i.etapa));
  const conta = (s: string) => ativos.filter((i) => i.atencao.severidade === s).length;
  const criticas = conta('CRITICA');
  const altas = conta('ALTA');
  const medias = conta('MEDIA');
  const baixas = conta('BAIXA');
  const urgentes = criticas + altas + medias;

  const partes = [
    criticas && plural(criticas, 'crítica', 'críticas'),
    altas && plural(altas, 'alta', 'altas'),
    medias && plural(medias, 'média', 'médias'),
  ].filter(Boolean);

  if (urgentes === 0 && baixas === 0) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-emerald-800">
        <CheckCircle2 className="size-4" aria-hidden />
        <span>Nenhuma oportunidade precisa de atenção agora.</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={
        urgentes > 0
          ? 'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-200 bg-red-50/70 px-4 py-2.5 text-slate-800'
          : 'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800'
      }
    >
      <AlertTriangle className={urgentes > 0 ? 'size-4 text-red-600' : 'size-4 text-slate-500'} aria-hidden />
      <span>
        {urgentes > 0 ? (
          <>
            <strong className="font-semibold">
              {plural(urgentes, 'oportunidade precisa', 'oportunidades precisam')} de atenção hoje
            </strong>
            : {partes.join(', ')}
          </>
        ) : (
          <strong className="font-semibold">Nenhuma urgência hoje</strong>
        )}
        {baixas > 0 && (
          <span className="text-slate-600"> · {plural(baixas, 'com dados incompletos', 'com dados incompletos')}</span>
        )}
        .
      </span>
      <Button variant="link" size="xs" className="px-0" onClick={() => onAlternarFiltro(!filtroAtivo)}>
        {filtroAtivo ? 'Mostrar todas' : 'Ver só essas'}
      </Button>
    </div>
  );
}
