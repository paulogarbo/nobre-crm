'use client';

import { ehFinal } from '@nobre/domain';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { useHoje, useVendedores } from '@/hooks/useEtapas';
import { useCriarOportunidade, useEditarOportunidade } from '@/hooks/useOportunidades';
import { ApiError, mensagemDeErro } from '@/lib/api/client';
import { useVendedorId } from '@/lib/identidade';
import {
  errosDoEsquema,
  errosDoServidorPorCampo,
  esquema,
  paraCorpo,
  textoOuNull,
  valoresIniciais,
  type Erros,
  type ItemForm,
  type ModoFormulario,
  type Valores,
} from './valores';

interface Opcoes {
  modo: ModoFormulario | null;
  onFechar: () => void;
  onCriada: (codigo: string) => void;
}

/** Estado, validação e envio do formulário de oportunidade (criar ou editar). */
export function useFormOportunidade({ modo, onFechar, onCriada }: Opcoes) {
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
    setValores((v) =>
      v ? { ...v, itens: v.itens.map((i) => (i.chave === chave ? { ...i, [campo]: valor } : i)) } : v,
    );
  }

  function errosDoServidor(erro: unknown) {
    if (erro instanceof ApiError && erro.code === 'VALIDACAO' && valores) {
      const issues =
        (erro.details as { issues?: Array<{ campo: string; mensagem: string }> } | undefined)?.issues ?? [];
      const mapeados = errosDoServidorPorCampo(issues, valores.itens);
      if (mapeados) {
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
      setErros(errosDoEsquema(resultado.error.issues, valores.itens));
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

  return {
    hoje,
    vendedores: vendedores.data ?? [],
    valores,
    somenteObservacoes,
    enviando,
    desabilitado,
    id,
    erroDe,
    atualizar,
    atualizarItem,
    enviar,
  };
}
