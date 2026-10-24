'use client';

import { ROTULOS, motivoDeBloqueio, type Etapa, type TipoTransicao } from '@nobre/domain';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { useHoje } from '@/hooks/useEtapas';
import { useMoverEtapa } from '@/hooks/useMoverEtapa';
import { useRegistrarContato } from '@/hooks/useOportunidades';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { paraDominio } from '@/lib/apresentacao';
import { DetalheOportunidade } from './DetalheOportunidade';
import { DialogMotivo } from './DialogMotivo';
import { FormOportunidade, type ModoFormulario } from './FormOportunidade';

interface AcoesContexto {
  /** Pede a mudança de etapa: explica se é inválida, pede motivo se preciso, senão envia. */
  solicitarMovimento(op: OportunidadeResumo, para: Etapa): void;
  /** Mensagem do domínio quando `para` não é destino possível (null se é). */
  explicarBloqueio(op: OportunidadeResumo, para: Etapa): string | null;
  registrarContato(op: OportunidadeResumo): void;
  abrirDetalhe(idOuCodigo: string): void;
  abrirFormulario(modo: ModoFormulario): void;
}

const Contexto = createContext<AcoesContexto | null>(null);

export function useAcoesOportunidade(): AcoesContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAcoesOportunidade fora do AcoesOportunidadeProvider');
  return ctx;
}

interface PedidoMotivo {
  op: OportunidadeResumo;
  para: Etapa;
  tipo: TipoTransicao;
}

export function AcoesOportunidadeProvider({ children }: { children: ReactNode }) {
  const hoje = useHoje();
  const mover = useMoverEtapa();
  const contato = useRegistrarContato();
  const [pedido, setPedido] = useState<PedidoMotivo | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<ModoFormulario | null>(null);

  const explicarBloqueio = useCallback(
    (op: OportunidadeResumo, para: Etapa) => {
      if (op.transicoesPermitidas.some((t) => t.para === para)) return null;
      // O servidor já disse que não pode (transicoesPermitidas); o domínio explica por quê.
      return (hoje && motivoDeBloqueio(paraDominio(op), para, hoje)) || `Não é possível mover para ${ROTULOS[para]}.`;
    },
    [hoje],
  );

  const solicitarMovimento = useCallback(
    (op: OportunidadeResumo, para: Etapa) => {
      if (para === op.etapa) return;
      const transicao = op.transicoesPermitidas.find((t) => t.para === para);
      if (!transicao) {
        toast.info(explicarBloqueio(op, para));
        return;
      }
      if (transicao.exigeMotivo) setPedido({ op, para, tipo: transicao.tipo });
      else mover.mutate({ op, para });
    },
    [explicarBloqueio, mover],
  );

  const valor = useMemo<AcoesContexto>(
    () => ({
      solicitarMovimento,
      explicarBloqueio,
      registrarContato: (op) => contato.mutate(op),
      abrirDetalhe: setDetalheId,
      abrirFormulario: setFormulario,
    }),
    [solicitarMovimento, explicarBloqueio, contato],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}

      <DialogMotivo
        pedido={pedido}
        onCancelar={() => setPedido(null)}
        onConfirmar={(motivo) => {
          if (pedido) mover.mutate({ op: pedido.op, para: pedido.para, motivo });
          setPedido(null);
        }}
      />

      <Dialog open={detalheId !== null} onOpenChange={(aberto) => !aberto && setDetalheId(null)}>
        <SheetContent aria-describedby={undefined}>
          {detalheId && <DetalheOportunidade idOuCodigo={detalheId} emPainel />}
        </SheetContent>
      </Dialog>

      <FormOportunidade
        modo={formulario}
        onFechar={() => setFormulario(null)}
        onCriada={(codigo) => setDetalheId(codigo)}
      />
    </Contexto.Provider>
  );
}
