import type { Filtros } from './api/tipos';

export const qk = {
  etapas: ['etapas'] as const,
  vendedores: ['vendedores'] as const,
  oportunidadesTodas: ['oportunidades'] as const,
  oportunidades: (f: Filtros) => ['oportunidades', f] as const,
  oportunidade: (id: string) => ['oportunidade', id] as const,
  followUpsTodos: ['follow-ups'] as const,
  followUps: (vendedorId: string | null) => ['follow-ups', vendedorId] as const,
};
