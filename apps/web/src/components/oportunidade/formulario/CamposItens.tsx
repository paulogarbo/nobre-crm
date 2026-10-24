'use client';

import { Info, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitivos';
import { novaChave, type ItemForm, type Valores } from './valores';

interface Props {
  valores: Valores;
  enviando: boolean;
  erroDe: (campo: string) => string | undefined;
  atualizar: <K extends keyof Valores>(campo: K, valor: Valores[K]) => void;
  atualizarItem: (chave: string, campo: keyof Omit<ItemForm, 'chave'>, valor: string) => void;
}

/** Lista editável de itens de brinde (os erros de cada item ficam na chave do item). */
export function CamposItens({ valores, enviando, erroDe, atualizar, atualizarItem }: Props) {
  return (
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
          <div>
            <Input
              aria-label={`Valor unitário do item ${n + 1}`}
              placeholder="Valor un. (opc.)"
              inputMode="decimal"
              value={item.valorUnitario}
              disabled={enviando}
              aria-invalid={Boolean(erroDe(`itens.${item.chave}.valorUnitario`))}
              onChange={(e) =>
                atualizarItem(item.chave, 'valorUnitario', e.target.value.replace(/[^\d.,]/g, ''))
              }
            />
            {erroDe(`itens.${item.chave}.valorUnitario`) && (
              <p className="mt-1 text-xs text-red-600">{erroDe(`itens.${item.chave}.valorUnitario`)}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remover item ${n + 1}`}
            onClick={() =>
              atualizar(
                'itens',
                valores.itens.filter((i) => i.chave !== item.chave),
              )
            }
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
          atualizar('itens', [
            ...valores.itens,
            { chave: novaChave(), descricao: '', quantidade: '', valorUnitario: '' },
          ])
        }
      >
        <Plus /> Adicionar item
      </Button>
    </fieldset>
  );
}
