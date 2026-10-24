import { Etapa, ROTULOS_CAMPOS, camposFaltantesParaApresentar, type CampoFaltante } from '@nobre/domain';
import { Info } from 'lucide-react';
import type { OportunidadeDetalhe } from '@/lib/api/tipos';
import { paraDominio } from '@/lib/apresentacao';
import { data, dataHora, haDias, moeda, quantidade, relativo } from '@/lib/formatadores';
import { Campo, Secao } from './Secao';

/** Dados da oportunidade, com o aviso do que falta para apresentar orçamento (regra do domínio). */
export function SecaoDados({ op, hoje }: { op: OportunidadeDetalhe; hoje: string }) {
  const faltando = new Set<CampoFaltante>(
    op.etapa === Etapa.PRIMEIRO_CONTATO ? camposFaltantesParaApresentar(paraDominio(op)) : [],
  );
  const avisoApresentar = (c: CampoFaltante) =>
    faltando.has(c) ? `necessário para apresentar orçamento (${ROTULOS_CAMPOS[c]})` : undefined;

  return (
    <Secao titulo="Dados">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Campo rotulo="Vendedor responsável">{op.vendedor.nome}</Campo>
        <Campo rotulo="Último contato">
          {data(op.ultimoContato)}{' '}
          {op.ultimoContato && <span className="text-slate-500">({haDias(op.diasSemContato)})</span>}
        </Campo>
        <Campo rotulo="Validade da proposta" aviso={avisoApresentar('validadeProposta')}>
          {data(op.validadeProposta)}{' '}
          {op.validadeProposta && (
            <span className="text-slate-500">({relativo(op.validadeProposta, hoje)})</span>
          )}
        </Campo>
        <Campo rotulo="Evento do cliente">
          {data(op.eventoCliente)}{' '}
          {op.eventoCliente && <span className="text-slate-500">({relativo(op.eventoCliente, hoje)})</span>}
        </Campo>
        <Campo rotulo="Valor estimado" aviso={avisoApresentar('valorEstimado')}>
          {moeda(op.valorEstimado)}
        </Campo>
        <Campo rotulo="CNPJ">{op.cnpj ?? '—'}</Campo>
        <Campo rotulo="Contato">
          {op.contatoNome || op.contatoEmail || op.contatoTelefone ? (
            <span className="flex flex-col">
              {op.contatoNome && <span>{op.contatoNome}</span>}
              {op.contatoEmail && <span className="text-slate-600">{op.contatoEmail}</span>}
              {op.contatoTelefone && <span className="text-slate-600">{op.contatoTelefone}</span>}
            </span>
          ) : (
            '—'
          )}
        </Campo>
        <Campo rotulo="Criada em">{dataHora(op.createdAt)}</Campo>
        {op.atualizadoPor && <Campo rotulo="Última edição dos dados por">{op.atualizadoPor.nome}</Campo>}
        <div className="sm:col-span-2">
          <Campo rotulo="Observações">
            {op.observacoes ? <span className="whitespace-pre-wrap">{op.observacoes}</span> : '—'}
          </Campo>
        </div>
      </dl>
    </Secao>
  );
}

export function SecaoItens({ op }: { op: OportunidadeDetalhe }) {
  return (
    <Secao titulo="Itens de brinde">
      {op.itens.length === 0 ? (
        <p className="flex items-center gap-1 text-sm text-amber-700">
          <Info className="size-4" aria-hidden /> Nenhum item. Sem item não é possível apresentar orçamento.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="pb-1 font-medium">Descrição</th>
              <th className="pb-1 text-right font-medium">Quantidade</th>
              <th className="pb-1 text-right font-medium">Valor unitário</th>
            </tr>
          </thead>
          <tbody>
            {op.itens.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-1.5">{i.descricao}</td>
                <td className="py-1.5 text-right">{quantidade(i.quantidade)}</td>
                <td className="py-1.5 text-right">
                  {i.valorUnitario === null ? '—' : moeda(i.valorUnitario)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Secao>
  );
}
