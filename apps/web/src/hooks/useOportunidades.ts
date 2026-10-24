'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mensagemDeErro } from '@/lib/api/client';
import { oportunidadesApi } from '@/lib/api/endpoints';
import type { CorpoOportunidade, Filtros, OportunidadeDetalhe } from '@/lib/api/tipos';
import { qk } from '@/lib/query-keys';

export function useOportunidades(filtros: Filtros) {
  return useQuery({
    queryKey: qk.oportunidades(filtros),
    queryFn: () => oportunidadesApi.listar(filtros),
    // ao digitar na busca, mantém o resultado anterior em vez de piscar o skeleton
    placeholderData: keepPreviousData,
  });
}

export function useOportunidade(idOuCodigo: string | null) {
  return useQuery({
    queryKey: qk.oportunidade(idOuCodigo ?? ''),
    queryFn: () => oportunidadesApi.detalhe(idOuCodigo!),
    enabled: Boolean(idOuCodigo),
  });
}

/** Depois de qualquer escrita: listas, detalhes e follow-ups voltam a refletir o servidor. */
export function invalidarTudo(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: qk.oportunidadesTodas });
  void qc.invalidateQueries({ queryKey: ['oportunidade'] });
  void qc.invalidateQueries({ queryKey: qk.followUpsTodos });
}

export function guardarDetalhe(qc: QueryClient, detalhe: OportunidadeDetalhe) {
  qc.setQueryData(qk.oportunidade(detalhe.id), detalhe);
  qc.setQueryData(qk.oportunidade(detalhe.codigo), detalhe);
}

export function useRegistrarContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (op: { id: string; codigo: string }) => oportunidadesApi.registrarContato(op.id),
    onSuccess: (detalhe) => {
      guardarDetalhe(qc, detalhe);
      toast.success(`Contato de hoje registrado em ${detalhe.codigo}.`);
    },
    onError: (erro) => toast.error(mensagemDeErro(erro)),
    onSettled: () => invalidarTudo(qc),
  });
}

export function useCriarOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (corpo: CorpoOportunidade) => oportunidadesApi.criar(corpo),
    onSuccess: (detalhe) => {
      guardarDetalhe(qc, detalhe);
      toast.success(`Oportunidade ${detalhe.codigo} criada.`);
    },
    onSettled: () => invalidarTudo(qc),
  });
}

export function useEditarOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, corpo }: { id: string; corpo: CorpoOportunidade }) => oportunidadesApi.editar(id, corpo),
    onSuccess: (detalhe) => {
      guardarDetalhe(qc, detalhe);
      toast.success(`${detalhe.codigo} atualizada.`);
    },
    onSettled: () => invalidarTudo(qc),
  });
}
