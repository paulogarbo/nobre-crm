import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Secao({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4', className)}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {children}
    </section>
  );
}

export function Campo({ rotulo, children, aviso }: { rotulo: string; children: ReactNode; aviso?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
      {aviso && (
        <dd className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
          <Info className="size-3" aria-hidden /> {aviso}
        </dd>
      )}
    </div>
  );
}
