'use client';

import { ehFinal } from '@nobre/domain';
import { Erro } from '@/components/estados/Estados';
import { DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/primitivos';
import { useHoje } from '@/hooks/useEtapas';
import { useOportunidade } from '@/hooks/useOportunidades';
import { ApiError } from '@/lib/api/client';
import type { OportunidadeDetalhe } from '@/lib/api/tipos';
import { CabecalhoDetalhe, FaixaFinalizada } from './detalhe/CabecalhoDetalhe';
import { Secao } from './detalhe/Secao';
import { FollowUpsAnteriores, SecaoAtencao, SecaoProximaAcao } from './detalhe/SecoesAcao';
import { SecaoDados, SecaoItens } from './detalhe/SecoesDados';
import { TimelineHistorico } from './TimelineHistorico';

export function DetalheOportunidade({ idOuCodigo, emPainel = false }: { idOuCodigo: string; emPainel?: boolean }) {
  const consulta = useOportunidade(idOuCodigo);
  const hoje = useHoje();

  if (consulta.isPending || !hoje) {
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        {emPainel && <DialogTitle className="sr-only">Carregando oportunidade</DialogTitle>}
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (consulta.isError) {
    const naoExiste = consulta.error instanceof ApiError && consulta.error.status === 404;
    return (
      <div className="p-6">
        {emPainel && <DialogTitle className="sr-only">Erro ao carregar</DialogTitle>}
        <Erro
          erro={consulta.error}
          titulo={naoExiste ? 'Oportunidade não encontrada.' : 'Não foi possível carregar a oportunidade.'}
          onTentarNovamente={() => void consulta.refetch()}
        />
      </div>
    );
  }
  return <Conteudo op={consulta.data} hoje={hoje} emPainel={emPainel} />;
}

/** Detalhe montado a partir das seções (cada uma em `./detalhe`). */
function Conteudo({ op, hoje, emPainel }: { op: OportunidadeDetalhe; hoje: string; emPainel: boolean }) {
  const final = ehFinal(op.etapa);
  const aberto = op.followUps.find((f) => f.status === 'ABERTO');
  const anteriores = op.followUps.filter((f) => f.status !== 'ABERTO');

  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6">
      {final && <FaixaFinalizada op={op} />}
      <CabecalhoDetalhe op={op} emPainel={emPainel} />
      {!final && <SecaoAtencao op={op} />}
      {aberto && <SecaoProximaAcao aberto={aberto} hoje={hoje} />}
      <SecaoDados op={op} hoje={hoje} />
      <SecaoItens op={op} />
      <Secao titulo="Histórico de etapas">
        <TimelineHistorico historico={op.historico} />
      </Secao>
      {anteriores.length > 0 && <FollowUpsAnteriores anteriores={anteriores} />}
    </div>
  );
}
