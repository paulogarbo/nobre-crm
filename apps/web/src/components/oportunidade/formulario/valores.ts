// Estado do formulário de oportunidade: tipos, conversão de/para o corpo da API, validação de formato
// e mapeamento de erros. Sem React: testável isoladamente.
import { diasEntre, ehDataCivilValida, formatarDataBR } from '@nobre/domain';
import { z } from 'zod';
import type { CorpoOportunidade, OportunidadeDetalhe } from '@/lib/api/tipos';

export type ModoFormulario = { tipo: 'criar' } | { tipo: 'editar'; op: OportunidadeDetalhe };

export interface ItemForm {
  chave: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
}

export interface Valores {
  empresa: string;
  vendedorId: string;
  valorEstimado: string;
  ultimoContato: string;
  validadeProposta: string;
  eventoCliente: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  cnpj: string;
  observacoes: string;
  itens: ItemForm[];
}

let contadorChave = 0;
export const novaChave = () => `item-${++contadorChave}`;

/** "4.500,00", "4500", "R$ 4.500" → 4500. Ponto é separador de milhar (pt-BR). */
export function lerValor(texto: string): number | null {
  const limpo = texto
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (limpo === '') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

const valorParaTexto = (n: number | null) =>
  n === null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });

export function valoresIniciais(modo: ModoFormulario, vendedorPadrao: string): Valores {
  if (modo.tipo === 'criar') {
    return {
      empresa: '',
      vendedorId: vendedorPadrao,
      valorEstimado: '',
      ultimoContato: '',
      validadeProposta: '',
      eventoCliente: '',
      contatoNome: '',
      contatoEmail: '',
      contatoTelefone: '',
      cnpj: '',
      observacoes: '',
      itens: [{ chave: novaChave(), descricao: '', quantidade: '', valorUnitario: '' }],
    };
  }
  const op = modo.op;
  return {
    empresa: op.empresa,
    vendedorId: op.vendedor.id,
    valorEstimado: valorParaTexto(op.valorEstimado),
    ultimoContato: op.ultimoContato ?? '',
    validadeProposta: op.validadeProposta ?? '',
    eventoCliente: op.eventoCliente ?? '',
    contatoNome: op.contatoNome ?? '',
    contatoEmail: op.contatoEmail ?? '',
    contatoTelefone: op.contatoTelefone ?? '',
    cnpj: op.cnpj ?? '',
    observacoes: op.observacoes ?? '',
    itens: op.itens.map((i) => ({
      chave: novaChave(),
      descricao: i.descricao,
      quantidade: String(i.quantidade),
      valorUnitario: valorParaTexto(i.valorUnitario),
    })),
  };
}

const dataOpcional = z.string().refine((v) => v === '' || ehDataCivilValida(v), 'data inválida');

/** Validação de formato no cliente (a mesma do corpo da API). As regras de negócio ficam no servidor. */
export function esquema(hoje: string) {
  return z.object({
    empresa: z.string().trim().min(2, 'Informe o nome da empresa (mínimo 2 caracteres).'),
    vendedorId: z.string().min(1, 'Escolha o vendedor.'),
    valorEstimado: z.string().refine((v) => {
      const n = lerValor(v);
      return n === null || (!Number.isNaN(n) && n >= 0);
    }, 'Valor inválido. Ex.: 4.500,00'),
    ultimoContato: dataOpcional.refine(
      (v) => v === '' || !ehDataCivilValida(v) || diasEntre(hoje, v) <= 0,
      `Não pode ser depois de hoje (${formatarDataBR(hoje)}).`,
    ),
    validadeProposta: dataOpcional,
    eventoCliente: dataOpcional,
    contatoNome: z.string(),
    contatoEmail: z
      .string()
      .trim()
      .refine((v) => v === '' || z.email().safeParse(v).success, 'E-mail inválido.'),
    contatoTelefone: z.string(),
    cnpj: z.string(),
    observacoes: z.string(),
    itens: z.array(
      z.object({
        chave: z.string(),
        descricao: z.string().trim().min(2, 'Descreva o item.'),
        quantidade: z
          .string()
          .refine((v) => /^\d+$/.test(v.trim()) && Number(v) > 0, 'Quantidade inteira maior que zero.'),
        valorUnitario: z.string().refine((v) => {
          const n = lerValor(v);
          return n === null || (!Number.isNaN(n) && n >= 0);
        }, 'Valor inválido.'),
      }),
    ),
  });
}

export const textoOuNull = (v: string) => (v.trim() === '' ? null : v.trim());

export function paraCorpo(v: Valores): CorpoOportunidade {
  return {
    empresa: v.empresa.trim(),
    vendedorId: v.vendedorId,
    valorEstimado: lerValor(v.valorEstimado),
    ultimoContato: textoOuNull(v.ultimoContato),
    validadeProposta: textoOuNull(v.validadeProposta),
    eventoCliente: textoOuNull(v.eventoCliente),
    contatoNome: textoOuNull(v.contatoNome),
    contatoEmail: textoOuNull(v.contatoEmail),
    contatoTelefone: textoOuNull(v.contatoTelefone),
    cnpj: textoOuNull(v.cnpj),
    observacoes: textoOuNull(v.observacoes),
    itens: v.itens.map((i) => ({
      descricao: i.descricao.trim(),
      quantidade: Number(i.quantidade),
      valorUnitario: lerValor(i.valorUnitario),
    })),
  };
}

export type Erros = Record<string, string>;

/** Campos com mensagem de erro na tela (os de item ficam em `itens.<chave>.<campo>`). */
const CAMPOS_COM_ERRO = new Set([
  'empresa',
  'vendedorId',
  'valorEstimado',
  'ultimoContato',
  'validadeProposta',
  'eventoCliente',
  'cnpj',
  'contatoNome',
  'contatoEmail',
  'contatoTelefone',
  'observacoes',
]);
const CAMPOS_DE_ITEM = new Set(['descricao', 'quantidade', 'valorUnitario']);

/**
 * Erros de validação do servidor → chaves do formulário. O servidor aponta itens pela posição
 * (`itens.0.quantidade`); a tela, pela chave estável do item (`itens.item-3.quantidade`). Só entram
 * campos que têm onde aparecer; se nenhum casar, devolve null (o chamador mostra um aviso geral).
 */
export function errosDoServidorPorCampo(
  issues: Array<{ campo: string; mensagem: string }>,
  itens: Array<{ chave: string }>,
): Erros | null {
  const erros: Erros = {};
  for (const { campo, mensagem } of issues) {
    const item = /^itens\.(\d+)\.(\w+)$/.exec(campo);
    const chave = item ? itens[Number(item[1])]?.chave : undefined;
    if (item && chave && CAMPOS_DE_ITEM.has(item[2]!)) erros[`itens.${chave}.${item[2]}`] ??= mensagem;
    else if (CAMPOS_COM_ERRO.has(campo)) erros[campo] ??= mensagem;
  }
  return Object.keys(erros).length > 0 ? erros : null;
}

/** Erros da validação local → chaves do formulário (posição do item vira a chave estável do item). */
export function errosDoEsquema(issues: z.core.$ZodIssue[], itens: ItemForm[]): Erros {
  const erros: Erros = {};
  for (const issue of issues) {
    const caminho = issue.path
      .map((p) => (typeof p === 'number' ? (itens[p]?.chave ?? p) : String(p)))
      .join('.');
    erros[caminho] ??= issue.message;
  }
  return erros;
}
