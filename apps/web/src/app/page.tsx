'use client';

import { Plus } from 'lucide-react';
import { ResumoAtencao } from '@/components/atencao/ResumoAtencao';
import { AreaAtualizando, CarregandoBoard, Erro, SemResultados, Vazio } from '@/components/estados/Estados';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useAcoesOportunidade } from '@/components/oportunidade/AcoesOportunidade';
import { Button } from '@/components/ui/button';
import { useEtapas } from '@/hooks/useEtapas';
import { useFiltros } from '@/hooks/useFiltros';
import { useOportunidades } from '@/hooks/useOportunidades';

/** Visualização principal: o funil em Kanban, ordenado pelo que precisa de atenção. */
export default function PaginaKanban() {
  const { filtros, temFiltro, atencao, definir, limpar } = useFiltros();
  const etapas = useEtapas();
  const oportunidades = useOportunidades(filtros);
  const { abrirFormulario } = useAcoesOportunidade();

  if (oportunidades.isError || etapas.isError) {
    return (
      <Erro
        erro={oportunidades.error ?? etapas.error}
        onTentarNovamente={() => {
          void etapas.refetch();
          void oportunidades.refetch();
        }}
      />
    );
  }
  if (oportunidades.isPending || etapas.isPending) return <CarregandoBoard />;

  const { itens, total } = oportunidades.data;
  if (total === 0 && !temFiltro) {
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
      <h1 className="sr-only">Funil de oportunidades</h1>
      {total === 0 ? (
        <SemResultados onLimpar={limpar} />
      ) : (
        <ResumoAtencao itens={itens} filtroAtivo={atencao} onAlternarFiltro={(ativo) => definir({ atencao: ativo })} />
      )}
      <AreaAtualizando atualizando={oportunidades.isPlaceholderData}>
        <KanbanBoard itens={itens} hoje={etapas.data.hoje} />
      </AreaAtualizando>
    </div>
  );
}
