'use client';

import { SEVERIDADES } from '@nobre/domain';
import { Plus } from 'lucide-react';
import { IconeSeveridade } from '@/components/atencao/BadgeAtencao';
import { CarregandoLista, Erro, SemResultados, Vazio } from '@/components/estados/Estados';
import { CabecalhoLista } from '@/components/lista/CabecalhoLista';
import { LinhaOportunidade } from '@/components/lista/LinhaOportunidade';
import { useOrdenacaoLista } from '@/components/lista/useOrdenacaoLista';
import { useAcoesOportunidade } from '@/components/oportunidade/AcoesOportunidade';
import { Button } from '@/components/ui/button';
import { useEtapas } from '@/hooks/useEtapas';
import { useFiltros } from '@/hooks/useFiltros';
import { useOportunidades } from '@/hooks/useOportunidades';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { data } from '@/lib/formatadores';
import { cn } from '@/lib/utils';

/** Referência estável enquanto não há dados (evita reordenar a cada render). */
const SEM_ITENS: OportunidadeResumo[] = [];

export default function PaginaLista() {
  const { filtros, temFiltro, limpar } = useFiltros();
  const etapas = useEtapas();
  const consulta = useOportunidades(filtros);
  const { abrirFormulario } = useAcoesOportunidade();
  const { ordem, linhas, ordenarPor } = useOrdenacaoLista(consulta.data?.itens ?? SEM_ITENS);

  if (consulta.isError) return <Erro erro={consulta.error} onTentarNovamente={() => void consulta.refetch()} />;
  if (consulta.isPending || etapas.isPending) return <CarregandoLista />;

  const hoje = etapas.data?.hoje ?? consulta.data.hoje;
  if (consulta.data.total === 0 && !temFiltro) {
    return (
      <Vazio titulo="Nenhuma oportunidade cadastrada.">
        <Button onClick={() => abrirFormulario({ tipo: 'criar' })}>
          <Plus /> Criar a primeira
        </Button>
      </Vazio>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Oportunidades</h1>
        <p className="text-xs text-slate-500">
          {consulta.data.total} resultado(s) · {ordem.coluna === 'prioridade' ? 'ordenadas por prioridade' : 'clique no cabeçalho para ordenar'}
        </p>
      </div>
      {consulta.data.total === 0 && <SemResultados onLimpar={limpar} />}
      {/* troca de filtro: o resultado anterior fica esmaecido até o novo chegar */}
      <div
        aria-busy={consulta.isPlaceholderData}
        className={cn(
          'overflow-x-auto rounded-xl border border-slate-200 bg-white transition-opacity',
          consulta.isPlaceholderData && 'pointer-events-none opacity-60',
        )}
      >
        <table className="w-full min-w-[1100px] text-sm">
          <CabecalhoLista ordem={ordem} ordenarPor={ordenarPor} />
          <tbody>
            {linhas.map((op) => (
              <LinhaOportunidade key={op.id} op={op} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Legenda de atenção:{' '}
        {SEVERIDADES.map((s) => (
          <span key={s} className="mr-2 inline-flex items-center gap-1">
            <IconeSeveridade severidade={s} className="size-3" /> {s === 'CRITICA' ? 'crítica' : s === 'ALTA' ? 'alta' : s === 'MEDIA' ? 'média' : 'baixa'}
          </span>
        ))}
        · hoje é {data(hoje)}
      </p>
    </div>
  );
}
