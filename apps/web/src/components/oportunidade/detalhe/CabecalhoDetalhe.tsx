'use client';

import { Etapa, ehFinal } from '@nobre/domain';
import { ChevronDown, ExternalLink, Pencil, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import { BadgeEtapa, BadgeSeveridade } from '@/components/atencao/BadgeAtencao';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuTrigger } from '@/components/ui/menu';
import type { OportunidadeDetalhe } from '@/lib/api/tipos';
import { dataHora, moeda } from '@/lib/formatadores';
import { cn } from '@/lib/utils';
import { useAcoesOportunidade } from '../AcoesOportunidade';
import { ItensMoverPara } from '../MenuMoverPara';

/** Oportunidade final: data de encerramento e, se perdida, o motivo. */
export function FaixaFinalizada({ op }: { op: OportunidadeDetalhe }) {
  const finalizadaEm = op.historico.at(-1)?.createdAt;
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 text-sm',
        op.etapa === Etapa.FECHAMENTO ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-slate-100 text-slate-800',
      )}
    >
      <p className="font-medium">
        Oportunidade finalizada{finalizadaEm ? ` em ${dataHora(finalizadaEm)}` : ''}. Apenas observações podem ser editadas.
      </p>
      {op.motivoPerda && (
        <p className="mt-1">
          <span className="font-semibold">Motivo da perda:</span> {op.motivoPerda}
        </p>
      )}
    </div>
  );
}

/** Código, etapa, empresa, valor e as ações principais (contato, mover, editar). */
export function CabecalhoDetalhe({ op, emPainel }: { op: OportunidadeDetalhe; emPainel: boolean }) {
  const { registrarContato, abrirFormulario } = useAcoesOportunidade();
  const final = ehFinal(op.etapa);
  const Titulo = emPainel ? DialogTitle : 'h1';

  return (
    <header className="flex flex-col gap-3 pr-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-slate-500">{op.codigo}</span>
        <BadgeEtapa etapa={op.etapa} rotulo={op.etapaRotulo} />
        {!final && <BadgeSeveridade severidade={op.atencao.severidade} />}
        {emPainel && (
          <Link
            href={`/oportunidades/${op.codigo}`}
            className="ml-auto inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
          >
            Abrir em página <ExternalLink className="size-3" />
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Titulo className="text-xl font-semibold text-slate-900">{op.empresa}</Titulo>
        <span className="text-lg font-semibold text-slate-800">{moeda(op.valorEstimado)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {!final && (
          <>
            <Button size="sm" onClick={() => registrarContato(op)}>
              <PhoneCall /> Registrar contato hoje
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Mover para <ChevronDown />
                </Button>
              </MenuTrigger>
              <MenuContent align="start">
                <ItensMoverPara op={op} />
              </MenuContent>
            </Menu>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => abrirFormulario({ tipo: 'editar', op })}>
          <Pencil /> {final ? 'Editar observações' : 'Editar'}
        </Button>
      </div>
    </header>
  );
}
