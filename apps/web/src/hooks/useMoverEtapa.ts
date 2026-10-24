'use client';

import { ROTULOS, type Etapa } from '@nobre/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mensagemDeErro } from '@/lib/api/client';
import { oportunidadesApi } from '@/lib/api/endpoints';
import type { Listagem, OportunidadeResumo } from '@/lib/api/tipos';
import { qk } from '@/lib/query-keys';
import { guardarDetalhe, invalidarTudo } from './useOportunidades';

interface Movimento {
  op: OportunidadeResumo;
  para: Etapa;
  motivo?: string;
}

/**
 * Mudança de etapa otimista: o card vai para a nova coluna na hora; se o servidor recusar (422),
 * o snapshot volta e a mensagem do servidor aparece no toast.
 */
export function useMoverEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ op, para, motivo }: Movimento) => oportunidadesApi.transicionar(op.id, para, motivo),
    onMutate: async ({ op, para }) => {
      await qc.cancelQueries({ queryKey: qk.oportunidadesTodas });
      const snapshots = qc.getQueriesData<Listagem>({ queryKey: qk.oportunidadesTodas });
      qc.setQueriesData<Listagem>({ queryKey: qk.oportunidadesTodas }, (antigo) =>
        antigo
          ? {
              ...antigo,
              itens: antigo.itens.map((i) =>
                i.id === op.id ? { ...i, etapa: para, etapaRotulo: ROTULOS[para], transicoesPermitidas: [] } : i,
              ),
            }
          : antigo,
      );
      return { snapshots };
    },
    onError: (erro, _vars, contexto) => {
      contexto?.snapshots.forEach(([chave, dados]) => qc.setQueryData(chave, dados));
      toast.error(mensagemDeErro(erro));
    },
    onSuccess: (detalhe) => {
      guardarDetalhe(qc, detalhe);
      toast.success(`${detalhe.codigo} movida para ${detalhe.etapaRotulo}.`);
    },
    onSettled: () => invalidarTudo(qc),
  });
}
