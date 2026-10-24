// Espelho dos DTOs da API (apps/api/src/modules/*/*.schemas.ts).
import type { Etapa, Prioridade, Severidade, TipoFollowUp, TipoSinal, TipoTransicao } from '@nobre/domain';

export interface VendedorRef {
  id: string;
  nome: string;
}

export interface Vendedor extends VendedorRef {
  email: string;
}

export interface ItemDTO {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number | null;
}

export interface SinalDTO {
  tipo: TipoSinal;
  severidade: Severidade;
  mensagem: string;
}

export interface TransicaoPermitidaDTO {
  para: Etapa;
  exigeMotivo: boolean;
  tipo: TipoTransicao;
}

export interface ProximaAcaoDTO {
  id: string;
  tipo: TipoFollowUp;
  prioridade: Prioridade;
  titulo: string;
  venceEm: string;
}

export interface OportunidadeResumo {
  id: string;
  codigo: string;
  empresa: string;
  etapa: Etapa;
  etapaRotulo: string;
  vendedor: VendedorRef;
  valorEstimado: number | null;
  itens: ItemDTO[];
  ultimoContato: string | null;
  validadeProposta: string | null;
  eventoCliente: string | null;
  diasSemContato: number | null;
  atencao: { severidade: Severidade | null; score: number; sinais: SinalDTO[] };
  proximaAcao: ProximaAcaoDTO | null;
  transicoesPermitidas: TransicaoPermitidaDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface HistoricoDTO {
  id: string;
  deEtapa: Etapa | null;
  paraEtapa: Etapa;
  motivo: string | null;
  vendedor: VendedorRef;
  createdAt: string;
}

export type StatusFollowUp = 'ABERTO' | 'CONCLUIDO' | 'RESOLVIDO' | 'SUBSTITUIDO';

export interface FollowUpDaOportunidade {
  id: string;
  tipo: TipoFollowUp;
  prioridade: Prioridade;
  titulo: string;
  descricao: string;
  venceEm: string;
  status: StatusFollowUp;
  criadoEm: string;
  encerradoEm: string | null;
}

export interface OportunidadeDetalhe extends OportunidadeResumo {
  cnpj: string | null;
  contatoNome: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
  motivoPerda: string | null;
  observacoes: string | null;
  historico: HistoricoDTO[];
  followUps: FollowUpDaOportunidade[];
}

export interface Listagem {
  hoje: string;
  total: number;
  itens: OportunidadeResumo[];
}

export interface EtapaMeta {
  valor: Etapa;
  rotulo: string;
  ordem: number | null;
  final: boolean;
  transicoes: TransicaoPermitidaDTO[];
}

export interface EtapasResposta {
  hoje: string;
  referenciaFixa: boolean;
  etapas: EtapaMeta[];
}

export interface FollowUpDTO extends FollowUpDaOportunidade {
  oportunidade: {
    id: string;
    codigo: string;
    empresa: string;
    etapa: Etapa;
    etapaRotulo: string;
    valorEstimado: number | null;
    vendedor: VendedorRef;
  };
  atrasado: boolean;
}

export interface FollowUpsResposta {
  hoje: string;
  total: number;
  itens: FollowUpDTO[];
}

export interface ResultadoRecalculo {
  hoje: string;
  criados: number;
  resolvidos: number;
  substituidos: number;
  mantidos: number;
}

export interface ItemEntrada {
  descricao: string;
  quantidade: number;
  valorUnitario?: number | null;
}

export interface CorpoOportunidade {
  empresa?: string;
  vendedorId?: string;
  cnpj?: string | null;
  contatoNome?: string | null;
  contatoEmail?: string | null;
  contatoTelefone?: string | null;
  valorEstimado?: number | null;
  ultimoContato?: string | null;
  validadeProposta?: string | null;
  eventoCliente?: string | null;
  observacoes?: string | null;
  itens?: ItemEntrada[];
}

export interface Filtros {
  q?: string;
  vendedorId?: string;
  atencao?: boolean;
}
