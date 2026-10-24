'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mensagemDeErro } from '@/lib/api/client';
import { followUpsApi } from '@/lib/api/endpoints';
import { useVendedorId } from '@/lib/identidade';
import { qk } from '@/lib/query-keys';
import { guardarDetalhe, invalidarTudo } from './useOportunidades';

/** Ações abertas do vendedor em "Eu sou" (troca de identidade troca a lista). */
export function useFollowUps() {
  const vendedorId = useVendedorId();
  return useQuery({
    queryKey: qk.followUps(vendedorId),
    queryFn: followUpsApi.listar,
    enabled: Boolean(vendedorId),
    staleTime: 30_000,
  });
}

export function useConcluirFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => followUpsApi.concluir(id, { registrarContato: true }),
    onSuccess: ({ followUp, oportunidade }) => {
      guardarDetalhe(qc, oportunidade);
      const nova = oportunidade.proximaAcao;
      toast.success(
        nova
          ? `Ação concluída e contato registrado em ${followUp.oportunidade.codigo}. Ainda há o que fazer: ${nova.titulo}.`
          : `Ação concluída e contato registrado em ${followUp.oportunidade.codigo}.`,
      );
    },
    onError: (erro) => toast.error(mensagemDeErro(erro)),
    onSettled: () => invalidarTudo(qc),
  });
}

export function useRecalcularFollowUps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: followUpsApi.recalcular,
    onSuccess: (r) =>
      toast.success(
        `Recalculado: ${r.criados} criada(s), ${r.resolvidos} resolvida(s), ${r.substituidos} substituída(s), ${r.mantidos} mantida(s).`,
      ),
    onError: (erro) => toast.error(mensagemDeErro(erro)),
    onSettled: () => invalidarTudo(qc),
  });
}
