'use client';

import { useSyncExternalStore } from 'react';

// Stand-in de autenticação: o vendedor escolhido em "Eu sou" vai no header x-vendedor-id.
const CHAVE = 'nobre-crm.vendedorId';
const ouvintes = new Set<() => void>();

export function getVendedorId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function setVendedorId(id: string) {
  try {
    window.localStorage.setItem(CHAVE, id);
  } catch {
    // navegação privada sem storage: a escolha vale só nesta aba
  }
  ouvintes.forEach((o) => o());
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  const aoMudarStorage = (e: StorageEvent) => {
    if (e.key === CHAVE) ouvinte();
  };
  window.addEventListener('storage', aoMudarStorage);
  return () => {
    ouvintes.delete(ouvinte);
    window.removeEventListener('storage', aoMudarStorage);
  };
}

/** Id do vendedor selecionado em "Eu sou" (null até o seletor escolher o padrão). */
export function useVendedorId(): string | null {
  return useSyncExternalStore(assinar, getVendedorId, () => null);
}
