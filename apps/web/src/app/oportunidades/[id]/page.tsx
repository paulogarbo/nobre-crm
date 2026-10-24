'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DetalheOportunidade } from '@/components/oportunidade/DetalheOportunidade';

/** Link direto / refresh do detalhe (o mesmo componente abre em painel a partir do Kanban e da Lista). */
export default function PaginaDetalhe() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="mb-2 inline-flex items-center gap-1 text-[13px] text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Voltar ao Kanban
      </Link>
      <div className="rounded-xl border border-slate-200 bg-slate-50">
        <DetalheOportunidade idOuCodigo={decodeURIComponent(id)} />
      </div>
    </div>
  );
}
