'use client';

import { LIMIARES, ehFinal } from '@nobre/domain';
import { MoreHorizontal } from 'lucide-react';
import { BadgeEtapa, BadgeSeveridade, IconeSeveridade } from '@/components/atencao/BadgeAtencao';
import { useAcoesOportunidade } from '@/components/oportunidade/AcoesOportunidade';
import { ItensMoverPara } from '@/components/oportunidade/MenuMoverPara';
import { Button } from '@/components/ui/button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  Tooltip,
} from '@/components/ui/menu';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { data, haDias, moeda } from '@/lib/formatadores';
import { cn } from '@/lib/utils';

/** Uma oportunidade na tabela: clique abre o detalhe; o menu "⋯" tem as ações. */
export function LinhaOportunidade({ op }: { op: OportunidadeResumo }) {
  const { abrirDetalhe, registrarContato } = useAcoesOportunidade();
  const final = ehFinal(op.etapa);
  const sev = op.atencao.severidade;
  return (
    <tr
      key={op.id}
      onClick={() => abrirDetalhe(op.id)}
      className={cn('cursor-pointer border-t border-slate-100 hover:bg-slate-50', final && 'text-slate-500')}
    >
      <td className="px-3 py-2 font-mono text-xs">
        <button
          type="button"
          className="hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            abrirDetalhe(op.id);
          }}
        >
          {op.codigo}
        </button>
      </td>
      <td className="px-3 py-2 font-medium text-slate-900">{op.empresa}</td>
      <td className="px-3 py-2">
        <BadgeEtapa etapa={op.etapa} rotulo={op.etapaRotulo} />
      </td>
      <td className="px-3 py-2">{op.vendedor.nome}</td>
      <td className="px-3 py-2 text-right">{moeda(op.valorEstimado)}</td>
      <td className="px-3 py-2">
        {data(op.ultimoContato)}
        <span
          className={cn(
            'block text-xs text-slate-500',
            (op.diasSemContato ?? 0) >= LIMIARES.SEM_CONTATO_DIAS && !final && 'text-red-600',
          )}
        >
          {haDias(op.diasSemContato)}
        </span>
      </td>
      <td className="px-3 py-2">{data(op.validadeProposta)}</td>
      <td className="px-3 py-2">{data(op.eventoCliente)}</td>
      <td className="px-3 py-2">
        {final ? (
          <span className="text-xs">—</span>
        ) : (
          <Tooltip
            conteudo={
              op.atencao.sinais.length ? (
                <ul>
                  {op.atencao.sinais.map((s) => (
                    <li key={s.tipo}>• {s.mensagem}</li>
                  ))}
                </ul>
              ) : null
            }
          >
            <span className="inline-flex">
              <BadgeSeveridade severidade={sev} />
            </span>
          </Tooltip>
        )}
      </td>
      <td className="max-w-56 px-3 py-2">
        {op.proximaAcao && !final ? (
          <span className="flex items-center gap-1 text-xs text-slate-700">
            <IconeSeveridade severidade={op.proximaAcao.prioridade} className="size-3.5" />
            <span className="truncate">{op.proximaAcao.titulo}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label={`Ações de ${op.codigo}`}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {!final && (
              <>
                <MenuSub>
                  <MenuSubTrigger>Mover para…</MenuSubTrigger>
                  <MenuSubContent>
                    <ItensMoverPara op={op} />
                  </MenuSubContent>
                </MenuSub>
                <MenuItem onSelect={() => registrarContato(op)}>Registrar contato hoje</MenuItem>
                <MenuSeparator />
              </>
            )}
            <MenuItem onSelect={() => abrirDetalhe(op.id)}>Abrir detalhe</MenuItem>
          </MenuContent>
        </Menu>
      </td>
    </tr>
  );
}
