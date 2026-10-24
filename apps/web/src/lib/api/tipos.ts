// Tipos dos DTOs da API, derivados dos schemas zod do contrato (@nobre/contracts) que a própria API
// usa para validar e serializar: se um campo mudar lá, a web deixa de compilar em vez de divergir.
export type {
  EtapaMetaDTO as EtapaMeta,
  EtapasRespostaDTO as EtapasResposta,
  FollowUpDaOportunidadeDTO as FollowUpDaOportunidade,
  FollowUpDTO,
  FollowUpsRespostaDTO as FollowUpsResposta,
  HistoricoDTO,
  ItemDTO,
  ListagemDTO as Listagem,
  OportunidadeDetalheDTO as OportunidadeDetalhe,
  OportunidadeResumoDTO as OportunidadeResumo,
  ProximaAcaoDTO,
  ResultadoRecalculoDTO as ResultadoRecalculo,
  SinalDTO,
  StatusFollowUp,
  TransicaoPermitidaDTO,
  VendedorDTO as Vendedor,
  VendedorRef,
} from '@nobre/contracts';

/** Corpo de criação e de edição (no PATCH todos os campos são opcionais). */
export type { CorpoEditar as CorpoOportunidade } from '@nobre/contracts';

/** Filtros da URL (só da web). */
export interface Filtros {
  q?: string;
  vendedorId?: string;
  atencao?: boolean;
}
