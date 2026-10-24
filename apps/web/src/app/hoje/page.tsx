'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { CarregandoLista, Erro, Vazio } from '@/components/estados/Estados';
import { ListaFollowUps } from '@/components/follow-ups/ListaFollowUps';
import { Button } from '@/components/ui/button';
import { useVendedores } from '@/hooks/useEtapas';
import { useFollowUps, useRecalcularFollowUps } from '@/hooks/useFollowUps';
import { data } from '@/lib/formatadores';
import { useVendedorId } from '@/lib/identidade';

/** Painel de follow-ups do vendedor em "Eu sou": a lista do que fazer hoje, por prioridade. */
export default function PaginaHoje() {
  const vendedorId = useVendedorId();
  const vendedores = useVendedores();
  const consulta = useFollowUps();
  const recalcular = useRecalcularFollowUps();
  const nome = vendedores.data?.find((v) => v.id === vendedorId)?.nome;

  if (consulta.isError) {
    return <Erro erro={consulta.error} titulo="Não foi possível carregar suas ações." onTentarNovamente={() => void consulta.refetch()} />;
  }
  if (!vendedorId || consulta.isPending) return <CarregandoLista linhas={4} />;

  const { hoje, itens, total } = consulta.data;
  const atrasadas = itens.filter((f) => f.atrasado).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Hoje, {data(hoje)}
            {nome ? ` — ${nome}` : ''}
          </h1>
          <p className="text-sm text-slate-600">
            {total} {total === 1 ? 'ação aberta' : 'ações abertas'} · {atrasadas} {atrasadas === 1 ? 'atrasada' : 'atrasadas'}
          </p>
        </div>
        <Button variant="ghost" size="sm" disabled={recalcular.isPending} onClick={() => recalcular.mutate()}>
          <RefreshCw className={recalcular.isPending ? 'animate-spin' : undefined} /> Recalcular agora
        </Button>
      </div>

      {total === 0 ? (
        <Vazio titulo="Nenhuma ação pendente para você. Bom sinal.">
          <Link href="/" className="text-sm text-sky-700 hover:underline">
            Ver Kanban
          </Link>
        </Vazio>
      ) : (
        <ListaFollowUps itens={itens} hoje={hoje} />
      )}

      <p className="text-xs text-slate-500">
        As ações são geradas automaticamente a partir de evento do cliente, validade da proposta e tempo sem contato
        (uma por oportunidade, a mais urgente). Concluir registra o contato de hoje; se o motivo continuar (ex.: proposta
        vencida), uma nova ação aparece.
      </p>
    </div>
  );
}
