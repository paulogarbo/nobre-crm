import type { Etapa } from '@nobre/domain';
import { api } from './client';
import type {
  CorpoOportunidade,
  EtapasResposta,
  Filtros,
  FollowUpDTO,
  FollowUpsResposta,
  Listagem,
  OportunidadeDetalhe,
  ResultadoRecalculo,
  Vendedor,
} from './tipos';

function query(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const etapasApi = {
  listar: () => api<EtapasResposta>('/etapas'),
};

export const vendedoresApi = {
  listar: () => api<Vendedor[]>('/vendedores'),
};

export const oportunidadesApi = {
  listar: (f: Filtros) =>
    api<Listagem>(
      `/oportunidades${query({ q: f.q, vendedorId: f.vendedorId, atencao: f.atencao ? 'true' : undefined })}`,
    ),
  detalhe: (idOuCodigo: string) => api<OportunidadeDetalhe>(`/oportunidades/${encodeURIComponent(idOuCodigo)}`),
  criar: (corpo: CorpoOportunidade) => api<OportunidadeDetalhe>('/oportunidades', { method: 'POST', body: corpo }),
  editar: (id: string, corpo: CorpoOportunidade) =>
    api<OportunidadeDetalhe>(`/oportunidades/${id}`, { method: 'PATCH', body: corpo }),
  registrarContato: (id: string, corpo: { data?: string; observacao?: string } = {}) =>
    api<OportunidadeDetalhe>(`/oportunidades/${id}/contatos`, { method: 'POST', body: corpo }),
  transicionar: (id: string, para: Etapa, motivo?: string) =>
    api<OportunidadeDetalhe>(`/oportunidades/${id}/transicoes`, { method: 'POST', body: { para, motivo } }),
};

export const followUpsApi = {
  listar: () => api<FollowUpsResposta>('/follow-ups', { comIdentidade: true }),
  concluir: (id: string, corpo: { registrarContato?: boolean; observacao?: string } = {}) =>
    api<{ followUp: FollowUpDTO; oportunidade: OportunidadeDetalhe }>(`/follow-ups/${id}/concluir`, {
      method: 'POST',
      body: corpo,
    }),
  recalcular: () => api<ResultadoRecalculo>('/follow-ups/recalcular', { method: 'POST', body: {} }),
};
