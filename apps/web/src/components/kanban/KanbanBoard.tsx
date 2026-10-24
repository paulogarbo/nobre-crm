'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { Etapa, ROTULOS, TODAS_AS_ETAPAS, ehEtapa } from '@nobre/domain';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAcoesOportunidade } from '@/components/oportunidade/AcoesOportunidade';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { CardOportunidade } from './CardOportunidade';
import { KanbanColuna, type EstadoDestino } from './KanbanColuna';

/** Mouse: o que estiver sob o ponteiro. Teclado (sem ponteiro): a coluna mais próxima do card. */
const deteccaoDeColisao: CollisionDetection = (args) => {
  if (args.pointerCoordinates) {
    const sobPonteiro = pointerWithin(args);
    return sobPonteiro.length > 0 ? sobPonteiro : rectIntersection(args);
  }
  return closestCenter(args);
};

/** Setas ←/→ pulam de coluna em coluna (em vez de mover o card pixel a pixel). */
const coordenadasPorColuna: KeyboardCoordinateGetter = (evento, { context, currentCoordinates }) => {
  if (evento.code !== 'ArrowRight' && evento.code !== 'ArrowLeft') return undefined;
  evento.preventDefault();
  const colunas = [...context.droppableRects.entries()].sort(([, a], [, b]) => a.left - b.left);
  const atual = context.over?.id ?? context.active?.data.current?.op?.etapa;
  const indice = colunas.findIndex(([id]) => id === atual);
  const alvo = colunas[indice + (evento.code === 'ArrowRight' ? 1 : -1)];
  if (!alvo) return currentCoordinates;
  const [, rect] = alvo;
  return { x: rect.left + Math.min(12, rect.width / 4), y: rect.top + 48 };
};

const anuncios: Announcements = {
  onDragStart: ({ active }) => `Pegou ${String(active.data.current?.op?.codigo ?? '')}. Use as setas para escolher a coluna, espaço para soltar, Esc para cancelar.`,
  onDragOver: ({ over }) => (over && ehEtapa(over.id) ? `Sobre a coluna ${ROTULOS[over.id]}.` : 'Fora das colunas.'),
  onDragEnd: ({ over }) => (over && ehEtapa(over.id) ? `Soltou em ${ROTULOS[over.id]}.` : 'Soltou fora das colunas.'),
  onDragCancel: () => 'Movimento cancelado.',
};

export function KanbanBoard({ itens, hoje }: { itens: OportunidadeResumo[]; hoje: string }) {
  const { solicitarMovimento, explicarBloqueio } = useAcoesOportunidade();
  const [ativo, setAtivo] = useState<OportunidadeResumo | null>(null);
  const [perdidaAberta, setPerdidaAberta] = useState(false);

  const sensores = useSensors(
    // 6px de tolerância: clique abre o detalhe, arrasto move.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: coordenadasPorColuna,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const porEtapa = useMemo(() => {
    const mapa = new Map<Etapa, OportunidadeResumo[]>(TODAS_AS_ETAPAS.map((e) => [e, []]));
    for (const op of itens) mapa.get(op.etapa)?.push(op); // a API já entrega na ordem de prioridade
    return mapa;
  }, [itens]);

  // Durante o arrasto: quais colunas aceitam este card e por quê não as outras.
  const destinos = useMemo(() => {
    if (!ativo) return null;
    const mapa = new Map<Etapa, EstadoDestino>();
    for (const etapa of TODAS_AS_ETAPAS) {
      if (etapa === ativo.etapa) {
        mapa.set(etapa, { tipo: 'origem' });
        continue;
      }
      const t = ativo.transicoesPermitidas.find((x) => x.para === etapa);
      mapa.set(
        etapa,
        t ? { tipo: 'valido', exigeMotivo: t.exigeMotivo } : { tipo: 'invalido', motivo: explicarBloqueio(ativo, etapa) ?? '' },
      );
    }
    return mapa;
  }, [ativo, explicarBloqueio]);

  function aoIniciar(e: DragStartEvent) {
    setAtivo((e.active.data.current?.op as OportunidadeResumo | undefined) ?? null);
  }

  function aoSoltar(e: DragEndEvent) {
    const op = e.active.data.current?.op as OportunidadeResumo | undefined;
    setAtivo(null);
    const para = e.over?.id;
    if (!op || !para || !ehEtapa(para) || para === op.etapa) return;
    if (!op.transicoesPermitidas.some((t) => t.para === para)) {
      toast.info(explicarBloqueio(op, para));
      return;
    }
    solicitarMovimento(op, para);
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={deteccaoDeColisao}
      onDragStart={aoIniciar}
      onDragEnd={aoSoltar}
      onDragCancel={() => setAtivo(null)}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            'Para mover a oportunidade de etapa, pressione espaço, use as setas para escolher a coluna e espaço para soltar. Esc cancela. Enter abre o detalhe.',
        },
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-3">
        {TODAS_AS_ETAPAS.map((etapa) => {
          const ehPerdida = etapa === Etapa.PERDIDA;
          return (
            <KanbanColuna
              key={etapa}
              etapa={etapa}
              rotulo={ROTULOS[etapa]}
              itens={porEtapa.get(etapa) ?? []}
              hoje={hoje}
              destino={destinos?.get(etapa) ?? null}
              colapsavel={ehPerdida}
              colapsada={ehPerdida && !perdidaAberta}
              onAlternarColapso={() => setPerdidaAberta((v) => !v)}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>{ativo && <CardOportunidade op={ativo} hoje={hoje} overlay />}</DragOverlay>
    </DndContext>
  );
}
