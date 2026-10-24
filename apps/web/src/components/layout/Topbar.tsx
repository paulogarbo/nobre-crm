'use client';

import { CalendarDays, Kanban, List, ListTodo, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAcoesOportunidade } from '@/components/oportunidade/AcoesOportunidade';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/primitivos';
import { useEtapas, useVendedores } from '@/hooks/useEtapas';
import { useFiltros } from '@/hooks/useFiltros';
import { useFollowUps } from '@/hooks/useFollowUps';
import { data } from '@/lib/formatadores';
import { useVendedorId } from '@/lib/identidade';
import { cn } from '@/lib/utils';
import { SeletorIdentidade } from './SeletorIdentidade';

function IndicadorDataReferencia() {
  const etapas = useEtapas();
  if (!etapas.data) return null;
  const { hoje, referenciaFixa } = etapas.data;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px]',
        referenciaFixa ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'text-slate-600',
      )}
      title={referenciaFixa ? 'Os cálculos usam a data de referência definida em REFERENCE_DATE.' : undefined}
    >
      <CalendarDays className="size-3.5" aria-hidden />
      Hoje: {data(hoje)}
      {referenciaFixa && ' (data de referência)'}
    </span>
  );
}

function Busca() {
  const { q, definir } = useFiltros();
  const [texto, setTexto] = useState(q);

  // URL → campo (ex.: "Limpar filtros")
  useEffect(() => setTexto(q), [q]);

  // campo → URL, com debounce de 300ms
  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => definir({ q: texto.trim() }), 300);
    return () => clearTimeout(t);
  }, [texto, q, definir]);

  return (
    <div className="relative w-full sm:w-80">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input
        type="search"
        aria-label="Buscar por empresa, código ou brinde"
        placeholder="Buscar empresa, código, brinde"
        className="pl-8 pr-8"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {texto && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
          aria-label="Limpar busca"
          onClick={() => setTexto('')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function Filtros() {
  const { vendedorId, atencao, definir } = useFiltros();
  const vendedores = useVendedores();
  const eu = useVendedorId();
  const { abrirFormulario } = useAcoesOportunidade();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-1.5 text-[13px] text-slate-600">
        Vendedor:
        <Select
          className="h-8 w-32 py-0"
          value={vendedorId}
          onChange={(e) => definir({ vendedorId: e.target.value })}
          aria-label="Filtrar por vendedor"
        >
          <option value="">Todos</option>
          {vendedores.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
              {v.id === eu ? ' (eu)' : ''}
            </option>
          ))}
        </Select>
      </label>
      {eu && (
        <Button
          variant={vendedorId === eu ? 'secondary' : 'ghost'}
          size="xs"
          aria-pressed={vendedorId === eu}
          onClick={() => definir({ vendedorId: vendedorId === eu ? '' : eu })}
        >
          Minhas
        </Button>
      )}
      <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-slate-700">
        <input
          type="checkbox"
          className="size-4 rounded border-slate-300 accent-red-600"
          checked={atencao}
          onChange={(e) => definir({ atencao: e.target.checked })}
        />
        Só atenção
      </label>
      <Button size="sm" onClick={() => abrirFormulario({ tipo: 'criar' })}>
        <Plus /> Nova oportunidade
      </Button>
    </div>
  );
}

/**
 * Contador de ações abertas no link "Hoje". `aria-label` num `span` é ignorado pelos leitores de
 * tela; o número visível fica oculto para eles e o texto completo vai em `sr-only`.
 */
export function ContadorHoje({ total, ativo }: { total: number; ativo: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'rounded-full px-1.5 text-[11px] font-semibold',
          ativo ? 'bg-white text-slate-900' : total > 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700',
        )}
      >
        {total}
      </span>
      <span className="sr-only">, {total === 1 ? '1 ação aberta' : `${total} ações abertas`}</span>
    </>
  );
}

function LinkNav({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors [&_svg]:size-4',
        ativo ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
      )}
    >
      {children}
    </Link>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { queryString } = useFiltros();
  const followUps = useFollowUps();
  const totalHoje = followUps.data?.total;
  const sufixo = queryString ? `?${queryString}` : '';
  const comFiltros = pathname === '/' || pathname === '/oportunidades';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-2 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold tracking-tight text-slate-900">Nobre CRM</span>
            <span className="text-[13px] text-slate-500">· Brindes</span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1">
            <LinkNav href={`/${sufixo}`} ativo={pathname === '/'}>
              <Kanban aria-hidden /> Kanban
            </LinkNav>
            <LinkNav href={`/oportunidades${sufixo}`} ativo={pathname === '/oportunidades'}>
              <List aria-hidden /> Lista
            </LinkNav>
            <LinkNav href="/hoje" ativo={pathname === '/hoje'}>
              <ListTodo aria-hidden /> Hoje
              {totalHoje !== undefined && <ContadorHoje total={totalHoje} ativo={pathname === '/hoje'} />}
            </LinkNav>
          </nav>
          {comFiltros && <Busca />}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <SeletorIdentidade />
            <IndicadorDataReferencia />
          </div>
        </div>
        {comFiltros && <Filtros />}
      </div>
    </header>
  );
}
