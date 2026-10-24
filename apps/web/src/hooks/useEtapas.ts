'use client';

import { useQuery } from '@tanstack/react-query';
import { etapasApi, vendedoresApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query-keys';

/** Metadados do funil e o "hoje" do servidor (data de referência). */
export function useEtapas() {
  return useQuery({ queryKey: qk.etapas, queryFn: etapasApi.listar, staleTime: 5 * 60_000 });
}

export function useVendedores() {
  return useQuery({ queryKey: qk.vendedores, queryFn: vendedoresApi.listar, staleTime: 5 * 60_000 });
}

/** "Hoje" usado pela UI para explicar regras (sempre o mesmo do servidor). */
export function useHoje(): string | undefined {
  return useEtapas().data?.hoje;
}
