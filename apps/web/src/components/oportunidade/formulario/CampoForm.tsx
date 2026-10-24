import type { ReactNode } from 'react';
import { Label } from '@/components/ui/primitivos';

/** Rótulo, controle e mensagem de erro (ou de ajuda) de um campo. */
export function CampoForm({
  id,
  rotulo,
  erro,
  ajuda,
  children,
  className,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="mt-1">{children}</div>
      {erro ? (
        <p id={`${id}-erro`} className="mt-1 text-xs text-red-600">
          {erro}
        </p>
      ) : (
        ajuda && <p className="mt-1 text-xs text-slate-500">{ajuda}</p>
      )}
    </div>
  );
}
