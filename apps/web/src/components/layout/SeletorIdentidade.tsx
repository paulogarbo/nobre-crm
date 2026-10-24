'use client';

import { UserRound } from 'lucide-react';
import { useEffect } from 'react';
import { Tooltip } from '@/components/ui/menu';
import { Select } from '@/components/ui/primitivos';
import { useVendedores } from '@/hooks/useEtapas';
import { setVendedorId, useVendedorId } from '@/lib/identidade';

/** "Eu sou": simula o usuário logado. O id escolhido vai no header x-vendedor-id. */
export function SeletorIdentidade() {
  const vendedores = useVendedores();
  const atual = useVendedorId();

  useEffect(() => {
    const lista = vendedores.data;
    if (!lista?.length) return;
    // padrão: primeiro vendedor; também corrige um id salvo que não existe mais (banco recriado)
    if (!atual || !lista.some((v) => v.id === atual)) setVendedorId(lista[0]!.id);
  }, [vendedores.data, atual]);

  return (
    <Tooltip conteudo="Simula o usuário logado. Em produção vem da autenticação." lado="bottom">
      <label className="flex items-center gap-1.5 text-[13px] text-slate-600">
        <UserRound className="size-4 text-slate-400" aria-hidden />
        Eu sou:
        <Select
          aria-label="Eu sou (vendedor que está usando o sistema)"
          className="h-8 w-28 py-0"
          value={atual ?? ''}
          onChange={(e) => setVendedorId(e.target.value)}
          disabled={!vendedores.data}
        >
          {!vendedores.data && <option value="">…</option>}
          {vendedores.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
            </option>
          ))}
        </Select>
      </label>
    </Tooltip>
  );
}
