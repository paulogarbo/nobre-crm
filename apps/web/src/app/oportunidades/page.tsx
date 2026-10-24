'use client';

import { SEVERIDADES, TODAS_AS_ETAPAS, compararCodigo, ehFinal } from '@nobre/domain';
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BadgeEtapa, BadgeSeveridade, IconeSeveridade } from '@/components/atencao/BadgeAtencao';
import { CarregandoLista, Erro, SemResultados, Vazio } from '@/components/estados/Estados';
import { useAcoesOportunidade } from '@/components/oportunidade/AcoesOportunidade';
import { ItensMoverPara } from '@/components/oportunidade/MenuMoverPara';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger, Tooltip } from '@/components/ui/menu';
import { useEtapas } from '@/hooks/useEtapas';
import { useFiltros } from '@/hooks/useFiltros';
import { useOportunidades } from '@/hooks/useOportunidades';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { data, haDias, moeda } from '@/lib/formatadores';
import { cn } from '@/lib/utils';

type Coluna = 'prioridade' | 'codigo' | 'empresa' | 'etapa' | 'vendedor' | 'valor' | 'ultimoContato' | 'validade' | 'evento';

const COLUNAS: Array<{ chave: Coluna; rotulo: string; classe?: string }> = [
  { chave: 'codigo', rotulo: 'Código' },
  { chave: 'empresa', rotulo: 'Empresa' },
  { chave: 'etapa', rotulo: 'Etapa' },
  { chave: 'vendedor', rotulo: 'Vendedor' },
  { chave: 'valor', rotulo: 'Valor', classe: 'text-right' },
  { chave: 'ultimoContato', rotulo: 'Último contato' },
  { chave: 'validade', rotulo: 'Validade' },
  { chave: 'evento', rotulo: 'Evento' },
  { chave: 'prioridade', rotulo: 'Atenção' },
];

// Ordenação por coluna no cliente, sobre o resultado já carregado (a API entrega por prioridade).
const comparadores: Record<Coluna, (a: OportunidadeResumo, b: OportunidadeResumo) => number> = {
  prioridade: () => 0,
  codigo: (a, b) => compararCodigo(a.codigo, b.codigo),
  empresa: (a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'),
  etapa: (a, b) => TODAS_AS_ETAPAS.indexOf(a.etapa) - TODAS_AS_ETAPAS.indexOf(b.etapa),
  vendedor: (a, b) => a.vendedor.nome.localeCompare(b.vendedor.nome, 'pt-BR'),
  valor: (a, b) => (a.valorEstimado ?? 0) - (b.valorEstimado ?? 0),
  ultimoContato: (a, b) => (a.ultimoContato ?? '').localeCompare(b.ultimoContato ?? ''),
  validade: (a, b) => (a.validadeProposta ?? '9999').localeCompare(b.validadeProposta ?? '9999'),
  evento: (a, b) => (a.eventoCliente ?? '9999').localeCompare(b.eventoCliente ?? '9999'),
};

export default function PaginaLista() {
  const { filtros, temFiltro, limpar } = useFiltros();
  const etapas = useEtapas();
  const consulta = useOportunidades(filtros);
  const { abrirDetalhe, abrirFormulario, registrarContato } = useAcoesOportunidade();
  const [ordem, setOrdem] = useState<{ coluna: Coluna; direcao: 'asc' | 'desc' }>({ coluna: 'prioridade', direcao: 'asc' });

  const linhas = useMemo(() => {
    const itens = consulta.data?.itens ?? [];
    if (ordem.coluna === 'prioridade') return itens;
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    return [...itens].sort((a, b) => sinal * comparadores[ordem.coluna](a, b) || compararCodigo(a.codigo, b.codigo));
  }, [consulta.data, ordem]);

  function ordenarPor(coluna: Coluna) {
    setOrdem((o) =>
      o.coluna === coluna
        ? { coluna, direcao: o.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna, direcao: coluna === 'valor' ? 'desc' : 'asc' },
    );
  }

  if (consulta.isError) return <Erro erro={consulta.error} onTentarNovamente={() => void consulta.refetch()} />;
  if (consulta.isPending || etapas.isPending) return <CarregandoLista />;

  const hoje = etapas.data?.hoje ?? consulta.data.hoje;
  if (consulta.data.total === 0 && !temFiltro) {
    return (
      <Vazio titulo="Nenhuma oportunidade cadastrada.">
        <Button onClick={() => abrirFormulario({ tipo: 'criar' })}>
          <Plus /> Criar a primeira
        </Button>
      </Vazio>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Oportunidades</h1>
        <p className="text-xs text-slate-500">
          {consulta.data.total} resultado(s) · {ordem.coluna === 'prioridade' ? 'ordenadas por prioridade' : 'clique no cabeçalho para ordenar'}
        </p>
      </div>
      {consulta.data.total === 0 && <SemResultados onLimpar={limpar} />}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              {COLUNAS.map((c) => {
                const ativa = ordem.coluna === c.chave;
                const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.chave}
                    scope="col"
                    className={cn('px-3 py-2 font-medium', c.classe)}
                    aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" onClick={() => ordenarPor(c.chave)} className="inline-flex items-center gap-1 hover:text-slate-900">
                      {c.rotulo}
                      <Icone className={cn('size-3', !ativa && 'opacity-40')} aria-hidden />
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="px-3 py-2 font-medium">
                Próxima ação
              </th>
              <th scope="col" className="w-10 px-3 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((op) => {
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
                    <span className={cn('block text-xs text-slate-500', (op.diasSemContato ?? 0) >= 8 && !final && 'text-red-600')}>
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
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Legenda de atenção:{' '}
        {SEVERIDADES.map((s) => (
          <span key={s} className="mr-2 inline-flex items-center gap-1">
            <IconeSeveridade severidade={s} className="size-3" /> {s === 'CRITICA' ? 'crítica' : s === 'ALTA' ? 'alta' : s === 'MEDIA' ? 'média' : 'baixa'}
          </span>
        ))}
        · hoje é {data(hoje)}
      </p>
    </div>
  );
}
