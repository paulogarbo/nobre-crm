'use client';

import { Kanban, List, ListTodo } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { CarregandoBoard, CarregandoLista } from '@/components/estados/Estados';
import { Skeleton } from '@/components/ui/primitivos';

/**
 * O que o servidor entrega antes da hidratação: a moldura da Topbar e o skeleton da página. Sem dados
 * nem identidade (que só existem no navegador), mas sem tela vazia enquanto o JavaScript carrega.
 */
export function CascaEstatica() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-2 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-bold tracking-tight text-slate-900">Nobre CRM</span>
              <span className="text-[13px] text-slate-500">· Brindes</span>
            </span>
            <nav aria-label="Principal" className="flex items-center gap-1 text-[13px] font-medium text-slate-700">
              {[
                { href: '/', rotulo: 'Kanban', Icone: Kanban },
                { href: '/oportunidades', rotulo: 'Lista', Icone: List },
                { href: '/hoje', rotulo: 'Hoje', Icone: ListTodo },
              ].map(({ href, rotulo, Icone }) => (
                <a key={href} href={href} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 [&_svg]:size-4">
                  <Icone aria-hidden /> {rotulo}
                </a>
              ))}
            </nav>
            <Skeleton className="h-8 w-full sm:w-80" />
          </div>
          <Skeleton className="h-8 w-full max-w-xl" />
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-4 py-4">
        {pathname === '/' ? <CarregandoBoard /> : <CarregandoLista />}
      </main>
    </>
  );
}
