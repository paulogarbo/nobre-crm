import type { DataCivil } from './datas';
import type { Etapa } from './etapas';

export interface ItemBrindeDominio {
  descricao: string;
  quantidade: number;
  valorUnitario: number | null;
}

/** Oportunidade como o domínio a enxerga: objeto plano, sem Prisma e sem relógio. */
export interface OportunidadeDominio {
  id: string;
  codigo: string;
  etapa: Etapa;
  /** Em reais. */
  valorEstimado: number | null;
  itens: ItemBrindeDominio[];
  ultimoContato: DataCivil | null;
  validadeProposta: DataCivil | null;
  eventoCliente: DataCivil | null;
  motivoPerda: string | null;
  /** Data de criação (opcional). Usada só para dizer "há N dias" quando nunca houve contato. */
  criadaEm?: DataCivil | null;
}
