'use client';

import { MOTIVO_MIN_CARACTERES, ROTULOS, type Etapa, type TipoTransicao } from '@nobre/domain';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label, Textarea } from '@/components/ui/primitivos';
import type { OportunidadeResumo } from '@/lib/api/tipos';

interface Pedido {
  op: OportunidadeResumo;
  para: Etapa;
  tipo: TipoTransicao;
}

/** Perda e retornos exigem motivo (regra do domínio, validada de novo no servidor). */
export function DialogMotivo({
  pedido,
  onConfirmar,
  onCancelar,
}: {
  pedido: Pedido | null;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const id = useId();

  useEffect(() => {
    if (pedido) {
      setMotivo('');
      setTentou(false);
    }
  }, [pedido]);

  const perda = pedido?.tipo === 'perda';
  const valido = motivo.trim().length >= MOTIVO_MIN_CARACTERES;

  return (
    <Dialog open={pedido !== null} onOpenChange={(aberto) => !aberto && onCancelar()}>
      <DialogContent>
        {pedido && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setTentou(true);
              if (valido) onConfirmar(motivo.trim());
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {perda
                  ? `Marcar ${pedido.op.codigo} como Perdida`
                  : `Voltar ${pedido.op.codigo} para ${ROTULOS[pedido.para]}`}
              </DialogTitle>
              <DialogDescription>
                {pedido.op.empresa} · de {ROTULOS[pedido.op.etapa]} para {ROTULOS[pedido.para]}.{' '}
                {perda
                  ? 'Perdida é uma etapa final: a oportunidade não poderá mais mudar de etapa.'
                  : 'O motivo fica no histórico da oportunidade.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor={id}>{perda ? 'Motivo da perda' : 'Motivo do retorno'}</Label>
              <Textarea
                id={id}
                autoFocus
                value={motivo}
                maxLength={2000}
                onChange={(e) => setMotivo(e.target.value)}
                aria-invalid={tentou && !valido}
                aria-describedby={`${id}-ajuda`}
                placeholder={
                  perda
                    ? 'Por que perdemos? Ex.: preço, prazo, concorrente, sem resposta'
                    : 'Por que voltar? Ex.: cliente pediu revisão de quantidade'
                }
              />
              <p id={`${id}-ajuda`} className={tentou && !valido ? 'text-xs text-red-600' : 'text-xs text-slate-500'}>
                {tentou && !valido
                  ? `Escreva pelo menos ${MOTIVO_MIN_CARACTERES} caracteres.`
                  : `Mínimo de ${MOTIVO_MIN_CARACTERES} caracteres.`}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onCancelar}>
                Cancelar
              </Button>
              <Button type="submit" variant={perda ? 'destructive' : 'default'}>
                {perda ? 'Marcar como Perdida' : `Voltar para ${ROTULOS[pedido.para]}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
