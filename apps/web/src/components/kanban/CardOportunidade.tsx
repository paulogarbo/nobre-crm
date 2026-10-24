'use client';

import { useDraggable } from '@dnd-kit/core';
import { Etapa, LIMIARES, ehFinal } from '@nobre/domain';
import { ChevronRight, ExternalLink, MoreHorizontal, PhoneCall, Trophy, XCircle } from 'lucide-react';
import { BadgesAtencao, IconeSeveridade } from '@/components/atencao/BadgeAtencao';
import { useAcoesOportunidade } from '@/components/oportunidade/AcoesOportunidade';
import { ItensMoverPara } from '@/components/oportunidade/MenuMoverPara';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitivos';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from '@/components/ui/menu';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { ESTILO_SEVERIDADE } from '@/lib/apresentacao';
import { haDias, moeda, quantidade } from '@/lib/formatadores';
import { cn } from '@/lib/utils';

interface Props {
  op: OportunidadeResumo;
  hoje: string;
  /** Cópia exibida no DragOverlay enquanto arrasta. */
  overlay?: boolean;
}

export function CardOportunidade({ op, hoje, overlay = false }: Props) {
  const final = ehFinal(op.etapa);
  const { abrirDetalhe, registrarContato } = useAcoesOportunidade();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: op.id,
    data: { op },
    disabled: final || overlay,
  });

  const severidade = op.atencao.severidade;
  const [primeiroItem, ...outrosItens] = op.itens;
  const semContatoLongo = op.diasSemContato !== null && op.diasSemContato >= LIMIARES.SEM_CONTATO_DIAS;

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      aria-label={`${op.codigo}, ${op.empresa}${severidade ? `, atenção ${ESTILO_SEVERIDADE[severidade].rotulo.toLowerCase()}` : ''}. Enter abre o detalhe; espaço pega para mover.`}
      onClick={() => abrirDetalhe(op.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') abrirDetalhe(op.id);
      }}
      className={cn(
        'group relative cursor-pointer rounded-lg border border-slate-200 border-l-[3px] bg-white p-3 shadow-sm transition-shadow hover:shadow-md',
        severidade ? ESTILO_SEVERIDADE[severidade].borda : 'border-l-slate-200',
        final && 'cursor-default opacity-80',
        !final && 'touch-none',
        isDragging && 'opacity-30',
        overlay && 'w-[264px] rotate-1 cursor-grabbing shadow-xl',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="shrink-0 whitespace-nowrap pt-0.5 font-mono text-[11px] text-slate-500">{op.codigo}</span>
        <div className="flex items-start gap-1">
          {final ? (
            <Badge className={op.etapa === Etapa.FECHAMENTO ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
              {op.etapa === Etapa.FECHAMENTO ? <Trophy aria-hidden /> : <XCircle aria-hidden />}
              {op.etapa === Etapa.FECHAMENTO ? 'Fechada' : 'Perdida'}
            </Badge>
          ) : (
            <BadgesAtencao op={op} hoje={hoje} />
          )}
          {!overlay && (
            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-1.5 -mt-1 size-6 text-slate-400 hover:text-slate-700"
                  aria-label={`Ações de ${op.codigo}`}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent onClick={(e) => e.stopPropagation()}>
                {!final && (
                  <>
                    <MenuSub>
                      <MenuSubTrigger>Mover para…</MenuSubTrigger>
                      <MenuSubContent>
                        <ItensMoverPara op={op} />
                      </MenuSubContent>
                    </MenuSub>
                    <MenuItem onSelect={() => registrarContato(op)}>
                      <PhoneCall /> Registrar contato hoje
                    </MenuItem>
                    <MenuSeparator />
                  </>
                )}
                <MenuItem onSelect={() => abrirDetalhe(op.id)}>
                  <ExternalLink /> Abrir detalhe
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </div>
      </div>

      <h3 className="mt-1 font-semibold leading-snug text-slate-900">{op.empresa}</h3>
      {primeiroItem ? (
        <p className="mt-0.5 truncate text-[13px] text-slate-600">
          {primeiroItem.descricao} · {quantidade(primeiroItem.quantidade)}
          {outrosItens.length > 0 && <span className="text-slate-400"> +{outrosItens.length}</span>}
        </p>
      ) : (
        <p className="mt-0.5 text-[13px] italic text-slate-400">sem itens</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-[13px]">
        <span className="font-medium text-slate-800">{moeda(op.valorEstimado)}</span>
        <span className="truncate text-slate-500">
          {op.vendedor.nome} ·{' '}
          <span className={cn(semContatoLongo && !final && 'font-medium text-red-600')}>{haDias(op.diasSemContato)}</span>
        </span>
      </div>

      {op.proximaAcao && !final && (
        <p className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2 text-[12px] text-slate-700">
          <IconeSeveridade severidade={op.proximaAcao.prioridade} className="size-3.5" />
          <ChevronRight className="size-3 text-slate-400" aria-hidden />
          <span className="truncate">
            <span className="text-slate-500">Próxima ação:</span> {op.proximaAcao.titulo}
          </span>
        </p>
      )}
    </article>
  );
}
