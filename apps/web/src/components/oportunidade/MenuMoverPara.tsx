'use client';

import { ROTULOS, TODAS_AS_ETAPAS, type Etapa } from '@nobre/domain';
import { ArrowRight, Undo2, XCircle } from 'lucide-react';
import { MenuItem, MenuLabel } from '@/components/ui/menu';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { useAcoesOportunidade } from './AcoesOportunidade';

/**
 * Itens "Mover para…" (dentro de um Menu). Alternativa ao arrastar, acessível por teclado.
 * Destinos inválidos aparecem desabilitados com o motivo dado pelo domínio.
 */
export function ItensMoverPara({ op }: { op: OportunidadeResumo }) {
  const { solicitarMovimento, explicarBloqueio } = useAcoesOportunidade();
  const destinos = TODAS_AS_ETAPAS.filter((e) => e !== op.etapa);

  return (
    <>
      <MenuLabel>Mover {op.codigo} para…</MenuLabel>
      {destinos.map((para: Etapa) => {
        const transicao = op.transicoesPermitidas.find((t) => t.para === para);
        const bloqueio = transicao ? null : explicarBloqueio(op, para);
        const Icone = transicao?.tipo === 'retorno' ? Undo2 : transicao?.tipo === 'perda' ? XCircle : ArrowRight;
        return (
          <MenuItem
            key={para}
            disabled={!transicao}
            onSelect={() => solicitarMovimento(op, para)}
            title={bloqueio ?? undefined}
            className="items-start"
          >
            <Icone className="mt-0.5" />
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2">
                {ROTULOS[para]}
                {transicao?.exigeMotivo && (
                  <span className="rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-800">pede motivo</span>
                )}
              </span>
              {bloqueio && <span className="max-w-64 text-xs leading-snug text-slate-500">{bloqueio}</span>}
            </span>
          </MenuItem>
        );
      })}
    </>
  );
}
