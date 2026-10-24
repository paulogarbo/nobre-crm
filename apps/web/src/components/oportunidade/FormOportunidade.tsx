'use client';

import { diasEntre, ehDataCivilValida, ehFinal, formatarDataBR } from '@nobre/domain';
import { Info, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/primitivos';
import { useHoje, useVendedores } from '@/hooks/useEtapas';
import { useCriarOportunidade, useEditarOportunidade } from '@/hooks/useOportunidades';
import { ApiError, mensagemDeErro } from '@/lib/api/client';
import type { CorpoOportunidade, OportunidadeDetalhe } from '@/lib/api/tipos';
import { useVendedorId } from '@/lib/identidade';

export type ModoFormulario = { tipo: 'criar' } | { tipo: 'editar'; op: OportunidadeDetalhe };

interface ItemForm {
  chave: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
}

interface Valores {
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
const novaChave = () => `item-${++contadorChave}`;

/** "4.500,00", "4500", "R$ 4.500" → 4500. Ponto é separador de milhar (pt-BR). */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (limpo === '') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

const valorParaTexto = (n: number | null) =>
  n === null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });

function valoresIniciais(modo: ModoFormulario, vendedorPadrao: string): Valores {
  if (modo.tipo === 'criar') {
    return {
      empresa: '', vendedorId: vendedorPadrao, valorEstimado: '', ultimoContato: '', validadeProposta: '',
      eventoCliente: '', contatoNome: '', contatoEmail: '', contatoTelefone: '', cnpj: '', observacoes: '',
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
function esquema(hoje: string) {
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
    contatoEmail: z.string().trim().refine((v) => v === '' || z.email().safeParse(v).success, 'E-mail inválido.'),
    contatoTelefone: z.string(),
    cnpj: z.string(),
    observacoes: z.string(),
    itens: z.array(
      z.object({
        chave: z.string(),
        descricao: z.string().trim().min(2, 'Descreva o item.'),
        quantidade: z.string().refine((v) => /^\d+$/.test(v.trim()) && Number(v) > 0, 'Quantidade inteira maior que zero.'),
        valorUnitario: z.string().refine((v) => {
          const n = lerValor(v);
          return n === null || (!Number.isNaN(n) && n >= 0);
        }, 'Valor inválido.'),
      }),
    ),
  });
}

const textoOuNull = (v: string) => (v.trim() === '' ? null : v.trim());

function paraCorpo(v: Valores): CorpoOportunidade {
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

type Erros = Record<string, string>;

function CampoForm({
  id,
  rotulo,
  erro,
  ajuda,
  children,
  className,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="mt-1">{children}</div>
      {erro ? (
        <p id={`${id}-erro`} className="mt-1 text-xs text-red-600">
          {erro}
        </p>
      ) : (
        ajuda && <p className="mt-1 text-xs text-slate-500">{ajuda}</p>
      )}
    </div>
  );
}

export function FormOportunidade({
  modo,
  onFechar,
  onCriada,
}: {
  modo: ModoFormulario | null;
  onFechar: () => void;
  onCriada: (codigo: string) => void;
}) {
  const hoje = useHoje() ?? '';
  const vendedores = useVendedores();
  const identidade = useVendedorId();
  const criar = useCriarOportunidade();
  const editar = useEditarOportunidade();
  const [valores, setValores] = useState<Valores | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const base = useId();

  useEffect(() => {
    if (modo) {
      setValores(valoresIniciais(modo, identidade ?? vendedores.data?.[0]?.id ?? ''));
      setErros({});
    } else {
      setValores(null);
    }
    // só reinicia ao abrir/trocar de modo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const somenteObservacoes = modo?.tipo === 'editar' && ehFinal(modo.op.etapa);
  const enviando = criar.isPending || editar.isPending;
  const id = (campo: string) => `${base}-${campo}`;

  function atualizar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setValores((v) => (v ? { ...v, [campo]: valor } : v));
  }

  function atualizarItem(chave: string, campo: keyof Omit<ItemForm, 'chave'>, valor: string) {
    setValores((v) => (v ? { ...v, itens: v.itens.map((i) => (i.chave === chave ? { ...i, [campo]: valor } : i)) } : v));
  }

  function errosDoServidor(erro: unknown) {
    if (erro instanceof ApiError && erro.code === 'VALIDACAO') {
      const issues = (erro.details as { issues?: Array<{ campo: string; mensagem: string }> } | undefined)?.issues ?? [];
      const mapeados: Erros = {};
      for (const i of issues) if (i.campo) mapeados[i.campo] = i.mensagem;
      if (Object.keys(mapeados).length > 0) {
        setErros(mapeados);
        return;
      }
    }
    toast.error(mensagemDeErro(erro));
  }

  async function enviar() {
    if (!valores || !modo) return;
    if (somenteObservacoes && modo.tipo === 'editar') {
      editar.mutate(
        { id: modo.op.id, corpo: { observacoes: textoOuNull(valores.observacoes) } },
        { onSuccess: onFechar, onError: errosDoServidor },
      );
      return;
    }
    const resultado = esquema(hoje).safeParse(valores);
    if (!resultado.success) {
      const novos: Erros = {};
      for (const issue of resultado.error.issues) {
        const caminho = issue.path.map((p) => (typeof p === 'number' ? valores.itens[p]?.chave ?? p : String(p))).join('.');
        novos[caminho] ??= issue.message;
      }
      setErros(novos);
      return;
    }
    setErros({});
    const corpo = paraCorpo(valores);
    if (modo.tipo === 'criar') {
      criar.mutate(corpo, {
        onSuccess: (criada) => {
          onFechar();
          onCriada(criada.codigo);
        },
        onError: errosDoServidor,
      });
    } else {
      editar.mutate({ id: modo.op.id, corpo }, { onSuccess: onFechar, onError: errosDoServidor });
    }
  }

  const desabilitado = somenteObservacoes || enviando;
  const erroDe = (campo: string) => erros[campo];

  return (
    <Dialog open={modo !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-2xl">
        {modo && valores && (
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <DialogHeader>
              <DialogTitle>{modo.tipo === 'criar' ? 'Nova oportunidade' : `Editar ${modo.op.codigo}`}</DialogTitle>
              <DialogDescription>
                {modo.tipo === 'criar'
                  ? 'A oportunidade nasce em Primeiro Contato. Para apresentar orçamento ela vai precisar de valor estimado, ao menos um item e validade da proposta.'
                  : somenteObservacoes
                    ? 'Oportunidade finalizada: apenas as observações podem ser editadas.'
                    : 'Altere os dados. A lista de itens enviada substitui a anterior.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoForm id={id('empresa')} rotulo="Empresa *" erro={erroDe('empresa')} className="sm:col-span-2">
                <Input
                  id={id('empresa')}
                  value={valores.empresa}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('empresa', e.target.value)}
                  aria-invalid={Boolean(erroDe('empresa'))}
                  autoFocus={!somenteObservacoes}
                />
              </CampoForm>
              <CampoForm id={id('vendedorId')} rotulo="Vendedor responsável" erro={erroDe('vendedorId')}>
                <Select
                  id={id('vendedorId')}
                  value={valores.vendedorId}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('vendedorId', e.target.value)}
                >
                  {vendedores.data?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </Select>
              </CampoForm>
              <CampoForm id={id('valorEstimado')} rotulo="Valor estimado (R$)" erro={erroDe('valorEstimado')}>
                <Input
                  id={id('valorEstimado')}
                  inputMode="decimal"
                  placeholder="4.500,00"
                  value={valores.valorEstimado}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('valorEstimado', e.target.value.replace(/[^\d.,]/g, ''))}
                  aria-invalid={Boolean(erroDe('valorEstimado'))}
                />
              </CampoForm>
              <CampoForm id={id('ultimoContato')} rotulo="Último contato" erro={erroDe('ultimoContato')}>
                <Input
                  id={id('ultimoContato')}
                  type="date"
                  max={hoje}
                  value={valores.ultimoContato}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('ultimoContato', e.target.value)}
                  aria-invalid={Boolean(erroDe('ultimoContato'))}
                />
              </CampoForm>
              <CampoForm
                id={id('validadeProposta')}
                rotulo="Validade da proposta"
                erro={erroDe('validadeProposta')}
                ajuda="Obrigatória para apresentar orçamento."
              >
                <Input
                  id={id('validadeProposta')}
                  type="date"
                  value={valores.validadeProposta}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('validadeProposta', e.target.value)}
                />
              </CampoForm>
              <CampoForm id={id('eventoCliente')} rotulo="Evento do cliente" erro={erroDe('eventoCliente')}>
                <Input
                  id={id('eventoCliente')}
                  type="date"
                  value={valores.eventoCliente}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('eventoCliente', e.target.value)}
                />
              </CampoForm>
              <CampoForm id={id('cnpj')} rotulo="CNPJ" erro={erroDe('cnpj')}>
                <Input id={id('cnpj')} value={valores.cnpj} disabled={desabilitado} onChange={(e) => atualizar('cnpj', e.target.value)} />
              </CampoForm>
              <CampoForm id={id('contatoNome')} rotulo="Contato (nome)" erro={erroDe('contatoNome')}>
                <Input
                  id={id('contatoNome')}
                  value={valores.contatoNome}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('contatoNome', e.target.value)}
                />
              </CampoForm>
              <CampoForm id={id('contatoEmail')} rotulo="E-mail do contato" erro={erroDe('contatoEmail')}>
                <Input
                  id={id('contatoEmail')}
                  type="email"
                  value={valores.contatoEmail}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('contatoEmail', e.target.value)}
                  aria-invalid={Boolean(erroDe('contatoEmail'))}
                />
              </CampoForm>
              <CampoForm id={id('contatoTelefone')} rotulo="Telefone do contato" erro={erroDe('contatoTelefone')}>
                <Input
                  id={id('contatoTelefone')}
                  type="tel"
                  value={valores.contatoTelefone}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('contatoTelefone', e.target.value)}
                />
              </CampoForm>
              <CampoForm id={id('observacoes')} rotulo="Observações" erro={erroDe('observacoes')} className="sm:col-span-2">
                <Textarea
                  id={id('observacoes')}
                  value={valores.observacoes}
                  disabled={enviando}
                  onChange={(e) => atualizar('observacoes', e.target.value)}
                  autoFocus={somenteObservacoes}
                />
              </CampoForm>
            </div>

            {!somenteObservacoes && (
              <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-[13px] font-medium text-slate-700">Itens de brinde</legend>
                {valores.itens.length === 0 && (
                  <p className="flex items-center gap-1 text-xs text-amber-700">
                    <Info className="size-3.5" aria-hidden /> Sem item não é possível apresentar orçamento.
                  </p>
                )}
                {valores.itens.map((item, n) => (
                  <div key={item.chave} className="grid grid-cols-[1fr_96px_120px_auto] items-start gap-2">
                    <div>
                      <Input
                        aria-label={`Descrição do item ${n + 1}`}
                        placeholder="Descrição (ex.: Caneca personalizada)"
                        value={item.descricao}
                        disabled={enviando}
                        onChange={(e) => atualizarItem(item.chave, 'descricao', e.target.value)}
                        aria-invalid={Boolean(erroDe(`itens.${item.chave}.descricao`))}
                      />
                      {erroDe(`itens.${item.chave}.descricao`) && (
                        <p className="mt-1 text-xs text-red-600">{erroDe(`itens.${item.chave}.descricao`)}</p>
                      )}
                    </div>
                    <div>
                      <Input
                        aria-label={`Quantidade do item ${n + 1}`}
                        placeholder="Qtd."
                        inputMode="numeric"
                        value={item.quantidade}
                        disabled={enviando}
                        onChange={(e) => atualizarItem(item.chave, 'quantidade', e.target.value.replace(/\D/g, ''))}
                        aria-invalid={Boolean(erroDe(`itens.${item.chave}.quantidade`))}
                      />
                      {erroDe(`itens.${item.chave}.quantidade`) && (
                        <p className="mt-1 text-xs text-red-600">{erroDe(`itens.${item.chave}.quantidade`)}</p>
                      )}
                    </div>
                    <Input
                      aria-label={`Valor unitário do item ${n + 1}`}
                      placeholder="Valor un. (opc.)"
                      inputMode="decimal"
                      value={item.valorUnitario}
                      disabled={enviando}
                      onChange={(e) => atualizarItem(item.chave, 'valorUnitario', e.target.value.replace(/[^\d.,]/g, ''))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover item ${n + 1}`}
                      onClick={() => atualizar('itens', valores.itens.filter((i) => i.chave !== item.chave))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={() =>
                    atualizar('itens', [...valores.itens, { chave: novaChave(), descricao: '', quantidade: '', valorUnitario: '' }])
                  }
                >
                  <Plus /> Adicionar item
                </Button>
              </fieldset>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onFechar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? 'Salvando…' : modo.tipo === 'criar' ? 'Criar oportunidade' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
