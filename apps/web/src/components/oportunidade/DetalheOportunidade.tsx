'use client';

import {
  Etapa,
  ROTULOS_CAMPOS,
  ROTULOS_TIPO_FOLLOW_UP,
  camposFaltantesParaApresentar,
  ehFinal,
  type CampoFaltante,
} from '@nobre/domain';
import { CheckCircle2, ChevronDown, ExternalLink, Info, Pencil, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BadgeEtapa, BadgePrioridade, BadgeSeveridade, ICONE_SINAL } from '@/components/atencao/BadgeAtencao';
import { Erro } from '@/components/estados/Estados';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/primitivos';
import { useHoje } from '@/hooks/useEtapas';
import { useConcluirFollowUp } from '@/hooks/useFollowUps';
import { useOportunidade } from '@/hooks/useOportunidades';
import { ApiError } from '@/lib/api/client';
import type { FollowUpDaOportunidade, OportunidadeDetalhe } from '@/lib/api/tipos';
import { ESTILO_SEVERIDADE, paraDominio } from '@/lib/apresentacao';
import { data, dataHora, haDias, moeda, quantidade, relativo } from '@/lib/formatadores';
import { cn } from '@/lib/utils';
import { useAcoesOportunidade } from './AcoesOportunidade';
import { ItensMoverPara } from './MenuMoverPara';
import { TimelineHistorico } from './TimelineHistorico';

const STATUS_FOLLOW_UP: Record<FollowUpDaOportunidade['status'], string> = {
  ABERTO: 'Aberto',
  CONCLUIDO: 'Concluído pelo vendedor',
  RESOLVIDO: 'Resolvido automaticamente',
  SUBSTITUIDO: 'Substituído por ação mais urgente',
};

function Secao({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4', className)}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {children}
    </section>
  );
}

function Campo({ rotulo, children, aviso }: { rotulo: string; children: ReactNode; aviso?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
      {aviso && (
        <dd className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
          <Info className="size-3" aria-hidden /> {aviso}
        </dd>
      )}
    </div>
  );
}

export function DetalheOportunidade({ idOuCodigo, emPainel = false }: { idOuCodigo: string; emPainel?: boolean }) {
  const consulta = useOportunidade(idOuCodigo);
  const hoje = useHoje();

  if (consulta.isPending || !hoje) {
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        {emPainel && <DialogTitle className="sr-only">Carregando oportunidade</DialogTitle>}
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (consulta.isError) {
    const naoExiste = consulta.error instanceof ApiError && consulta.error.status === 404;
    return (
      <div className="p-6">
        {emPainel && <DialogTitle className="sr-only">Erro ao carregar</DialogTitle>}
        <Erro
          erro={consulta.error}
          titulo={naoExiste ? 'Oportunidade não encontrada.' : 'Não foi possível carregar a oportunidade.'}
          onTentarNovamente={() => void consulta.refetch()}
        />
      </div>
    );
  }
  return <Conteudo op={consulta.data} hoje={hoje} emPainel={emPainel} />;
}

function Conteudo({ op, hoje, emPainel }: { op: OportunidadeDetalhe; hoje: string; emPainel: boolean }) {
  const { registrarContato, abrirFormulario } = useAcoesOportunidade();
  const concluir = useConcluirFollowUp();
  const final = ehFinal(op.etapa);
  const aberto = op.followUps.find((f) => f.status === 'ABERTO');
  const anteriores = op.followUps.filter((f) => f.status !== 'ABERTO');
  const finalizadaEm = final ? op.historico.at(-1)?.createdAt : undefined;
  const Titulo = emPainel ? DialogTitle : 'h1';

  // Em Primeiro Contato, o que falta para apresentar orçamento (regra do domínio).
  const faltando = new Set<CampoFaltante>(
    op.etapa === Etapa.PRIMEIRO_CONTATO ? camposFaltantesParaApresentar(paraDominio(op)) : [],
  );
  const avisoApresentar = (c: CampoFaltante) =>
    faltando.has(c) ? `necessário para apresentar orçamento (${ROTULOS_CAMPOS[c]})` : undefined;

  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6">
      {final && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            op.etapa === Etapa.FECHAMENTO ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-slate-100 text-slate-800',
          )}
        >
          <p className="font-medium">
            Oportunidade finalizada{finalizadaEm ? ` em ${dataHora(finalizadaEm)}` : ''}. Apenas observações podem ser editadas.
          </p>
          {op.motivoPerda && (
            <p className="mt-1">
              <span className="font-semibold">Motivo da perda:</span> {op.motivoPerda}
            </p>
          )}
        </div>
      )}

      <header className="flex flex-col gap-3 pr-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-500">{op.codigo}</span>
          <BadgeEtapa etapa={op.etapa} rotulo={op.etapaRotulo} />
          {!final && <BadgeSeveridade severidade={op.atencao.severidade} />}
          {emPainel && (
            <Link
              href={`/oportunidades/${op.codigo}`}
              className="ml-auto inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
            >
              Abrir em página <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Titulo className="text-xl font-semibold text-slate-900">{op.empresa}</Titulo>
          <span className="text-lg font-semibold text-slate-800">{moeda(op.valorEstimado)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!final && (
            <>
              <Button size="sm" onClick={() => registrarContato(op)}>
                <PhoneCall /> Registrar contato hoje
              </Button>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    Mover para <ChevronDown />
                  </Button>
                </MenuTrigger>
                <MenuContent align="start">
                  <ItensMoverPara op={op} />
                </MenuContent>
              </Menu>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => abrirFormulario({ tipo: 'editar', op })}>
            <Pencil /> {final ? 'Editar observações' : 'Editar'}
          </Button>
        </div>
      </header>

      {!final && (
        <Secao titulo="Atenção">
          {op.atencao.sinais.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden /> Nenhum alerta. Tudo em dia.
            </p>
          ) : (
            <ul className="space-y-2">
              {op.atencao.sinais.map((s) => {
                const Icone = ICONE_SINAL[s.tipo];
                const e = ESTILO_SEVERIDADE[s.severidade];
                return (
                  <li key={s.tipo} className={cn('flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm', e.fundo)}>
                    <Icone className={cn('mt-0.5 size-4 shrink-0', e.texto)} aria-hidden />
                    <span className="text-slate-800">{s.mensagem}</span>
                    <span className={cn('ml-auto text-xs font-medium', e.texto)}>{e.rotulo}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Secao>
      )}

      {aberto && (
        <Secao titulo="Próxima ação" className="border-sky-200 bg-sky-50/50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <BadgePrioridade prioridade={aberto.prioridade} />
                <p className="font-medium text-slate-900">{aberto.titulo}</p>
              </div>
              <p className="text-sm text-slate-700">{aberto.descricao}</p>
              <p className="text-xs text-slate-500">
                Prazo: {data(aberto.venceEm)} ({relativo(aberto.venceEm, hoje)}) ·{' '}
                {ROTULOS_TIPO_FOLLOW_UP[aberto.tipo]}
              </p>
            </div>
            <Button size="sm" disabled={concluir.isPending} onClick={() => concluir.mutate(aberto.id)}>
              <CheckCircle2 /> Concluir (registra contato)
            </Button>
          </div>
        </Secao>
      )}

      <Secao titulo="Dados">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Campo rotulo="Vendedor responsável">{op.vendedor.nome}</Campo>
          <Campo rotulo="Último contato">
            {data(op.ultimoContato)} {op.ultimoContato && <span className="text-slate-500">({haDias(op.diasSemContato)})</span>}
          </Campo>
          <Campo rotulo="Validade da proposta" aviso={avisoApresentar('validadeProposta')}>
            {data(op.validadeProposta)}{' '}
            {op.validadeProposta && <span className="text-slate-500">({relativo(op.validadeProposta, hoje)})</span>}
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
          <div className="sm:col-span-2">
            <Campo rotulo="Observações">
              {op.observacoes ? <span className="whitespace-pre-wrap">{op.observacoes}</span> : '—'}
            </Campo>
          </div>
        </dl>
      </Secao>

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
                  <td className="py-1.5 text-right">{i.valorUnitario === null ? '—' : moeda(i.valorUnitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Secao>

      <Secao titulo="Histórico de etapas">
        <TimelineHistorico historico={op.historico} />
      </Secao>

      {anteriores.length > 0 && (
        <details className="group rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
            Follow-ups anteriores ({anteriores.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {anteriores.map((f) => (
              <li key={f.id} className="text-sm">
                <span className="font-medium text-slate-800">{f.titulo}</span>
                <span className="block text-xs text-slate-500">
                  {STATUS_FOLLOW_UP[f.status]} · criado em {dataHora(f.criadoEm)}
                  {f.encerradoEm ? ` · encerrado em ${dataHora(f.encerradoEm)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
