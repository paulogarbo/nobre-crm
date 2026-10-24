'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { Filtros } from '@/lib/api/tipos';

/** Busca e filtros vivem na URL (?q=&vendedorId=&atencao=true): Kanban e Lista compartilham e dá para recarregar. */
export function useFiltros() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const q = params.get('q') ?? '';
  const vendedorId = params.get('vendedorId') ?? '';
  const atencao = params.get('atencao') === 'true';

  const filtros = useMemo<Filtros>(
    () => ({ q: q.trim() || undefined, vendedorId: vendedorId || undefined, atencao: atencao || undefined }),
    [q, vendedorId, atencao],
  );

  const definir = useCallback(
    (parcial: { q?: string; vendedorId?: string; atencao?: boolean }) => {
      // Lê a URL do momento da chamada (o debounce da busca pode disparar depois de outro filtro mudar).
      const novos = new URLSearchParams(window.location.search);
      for (const [chave, valor] of Object.entries(parcial)) {
        if (valor === undefined || valor === '' || valor === false) novos.delete(chave);
        else novos.set(chave, String(valor));
      }
      const s = novos.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const limpar = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  return {
    filtros,
    q,
    vendedorId,
    atencao,
    temFiltro: Boolean(filtros.q || filtros.vendedorId || filtros.atencao),
    /** Query string atual (para links entre Kanban e Lista manterem os filtros). */
    queryString: params.toString(),
    definir,
    limpar,
  };
}
