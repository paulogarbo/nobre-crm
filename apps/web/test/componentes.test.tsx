import { Etapa, TipoSinal } from '@nobre/domain';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadgesAtencao } from '@/components/atencao/BadgeAtencao';
import { ResumoAtencao } from '@/components/atencao/ResumoAtencao';
import { AreaAtualizando, SemResultados, Vazio } from '@/components/estados/Estados';
import { ContadorHoje } from '@/components/layout/Topbar';
import { errosDoServidorPorCampo, lerValor } from '@/components/oportunidade/FormOportunidade';
import { TooltipProvider } from '@/components/ui/menu';
import type { OportunidadeResumo } from '@/lib/api/tipos';
import { rotuloCurtoSinal } from '@/lib/apresentacao';

afterEach(cleanup);

function op(parcial: Partial<OportunidadeResumo>): OportunidadeResumo {
  return {
    id: '1', codigo: 'OPP-2003', empresa: 'Clínica Vida', etapa: Etapa.FOLLOW_UP, etapaRotulo: 'Follow-up',
    vendedor: { id: 'a', nome: 'Ana' }, valorEstimado: 7200, itens: [], ultimoContato: '2026-10-13',
    validadeProposta: '2026-10-20', eventoCliente: '2026-10-18', diasSemContato: 2,
    atencao: { severidade: null, score: 0, sinais: [] }, proximaAcao: null, transicoesPermitidas: [],
    createdAt: '', updatedAt: '', ...parcial,
  };
}

const critica = op({
  atencao: {
    severidade: 'CRITICA',
    score: 103.6,
    sinais: [{ tipo: TipoSinal.EVENTO_PROXIMO, severidade: 'CRITICA', mensagem: 'Evento do cliente em 3 dia(s) (18/10/2026).' }],
  },
});
const alta = (codigo: string) =>
  op({
    codigo,
    atencao: {
      severidade: 'ALTA',
      score: 90,
      sinais: [
        { tipo: TipoSinal.PROPOSTA_VENCIDA, severidade: 'ALTA', mensagem: 'Proposta vencida em 13/10/2026.' },
        { tipo: TipoSinal.SEM_CONTATO, severidade: 'ALTA', mensagem: 'Sem contato há 9 dias.' },
        { tipo: TipoSinal.EVENTO_PROXIMO, severidade: 'ALTA', mensagem: 'Evento do cliente em 5 dia(s).' },
      ],
    },
    diasSemContato: 9,
  });
const baixa = op({
  codigo: 'OPP-2001',
  etapa: Etapa.PRIMEIRO_CONTATO,
  atencao: { severidade: 'BAIXA', score: 12.25, sinais: [{ tipo: TipoSinal.DADOS_INCOMPLETOS, severidade: 'BAIXA', mensagem: 'x' }] },
});

describe('ResumoAtencao', () => {
  it('resume as urgências do dia e separa dados incompletos', () => {
    const alternar = vi.fn();
    render(<ResumoAtencao itens={[critica, alta('OPP-2002'), alta('OPP-2004'), baixa, op({ codigo: 'OPP-2005' })]} filtroAtivo={false} onAlternarFiltro={alternar} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('3 oportunidades precisam de atenção hoje');
    expect(status.textContent).toContain('1 crítica, 2 altas');
    expect(status.textContent).toContain('1 com dados incompletos');
    screen.getByRole('button', { name: 'Ver só essas' }).click();
    expect(alternar).toHaveBeenCalledWith(true);
  });

  it('sem sinais mostra que está tudo em dia', () => {
    render(<ResumoAtencao itens={[op({})]} filtroAtivo={false} onAlternarFiltro={() => {}} />);
    expect(screen.getByRole('status').textContent).toContain('Nenhuma oportunidade precisa de atenção agora');
  });
});

describe('BadgesAtencao', () => {
  it('mostra no máximo 2 badges com rótulo curto e agrupa o resto em +N', () => {
    render(
      <TooltipProvider>
        <BadgesAtencao op={alta('OPP-2002')} hoje="2026-10-15" />
      </TooltipProvider>,
    );
    expect(screen.getByText('Proposta vencida')).toBeTruthy();
    expect(screen.getByText('9d sem contato')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
  });

  it('rótulo curto do evento conta os dias a partir de hoje', () => {
    expect(rotuloCurtoSinal(critica.atencao.sinais[0]!, critica, '2026-10-15')).toBe('Evento em 3d');
  });
});

describe('estados', () => {
  it('Vazio e SemResultados são mensagens diferentes', () => {
    const limpar = vi.fn();
    render(<Vazio titulo="Nenhuma oportunidade cadastrada." />);
    render(<SemResultados onLimpar={limpar} />);
    expect(screen.getByText('Nenhuma oportunidade cadastrada.')).toBeTruthy();
    screen.getByRole('button', { name: 'Limpar filtros' }).click();
    expect(limpar).toHaveBeenCalled();
  });
});

describe('menu', () => {
  it('o link Hoje anuncia o número de ações para leitor de tela', () => {
    render(
      <a href="/hoje">
        Hoje <ContadorHoje total={3} ativo={false} />
      </a>,
    );
    expect(screen.getByRole('link').textContent).toContain('3 ações abertas');
    // o número visível fica fora do nome acessível; o texto completo entra
    expect(screen.getByRole('link', { name: /^Hoje\s*, 3 ações abertas$/ })).toBeTruthy();
  });
});

describe('troca de filtro', () => {
  it('enquanto a nova consulta não chega, o resultado anterior fica esmaecido e marcado como ocupado', () => {
    const { container, rerender } = render(
      <AreaAtualizando atualizando>
        <p>resultado anterior</p>
      </AreaAtualizando>,
    );
    const area = container.firstElementChild!;
    expect(area.getAttribute('aria-busy')).toBe('true');
    expect(area.className).toContain('opacity-60');
    rerender(
      <AreaAtualizando atualizando={false}>
        <p>resultado novo</p>
      </AreaAtualizando>,
    );
    expect(area.getAttribute('aria-busy')).toBe('false');
    expect(area.className).not.toContain('opacity-60');
  });
});

describe('formulário', () => {
  it('lê valores no formato brasileiro', () => {
    expect(lerValor('4.500,00')).toBe(4500);
    expect(lerValor('R$ 38.000')).toBe(38000);
    expect(lerValor('18,5')).toBe(18.5);
    expect(lerValor('')).toBeNull();
    expect(lerValor('abc')).toBeNaN();
  });

  it('erros do servidor por posição do item viram erros na chave do item', () => {
    const itens = [{ chave: 'item-7' }, { chave: 'item-9' }];
    expect(
      errosDoServidorPorCampo(
        [
          { campo: 'itens.1.quantidade', mensagem: 'deve ser maior que 0' },
          { campo: 'empresa', mensagem: 'muito curto' },
          { campo: 'itens.0.valorUnitario', mensagem: 'inválido' },
        ],
        itens,
      ),
    ).toEqual({
      'itens.item-9.quantidade': 'deve ser maior que 0',
      empresa: 'muito curto',
      'itens.item-7.valorUnitario': 'inválido',
    });
  });

  it('erro do servidor sem campo na tela devolve null (o formulário mostra um aviso geral)', () => {
    expect(errosDoServidorPorCampo([{ campo: 'itens.5.quantidade', mensagem: 'x' }], [{ chave: 'item-1' }])).toBeNull();
    expect(errosDoServidorPorCampo([{ campo: '', mensagem: 'corpo vazio' }], [])).toBeNull();
    expect(errosDoServidorPorCampo([{ campo: 'etapa', mensagem: 'desconhecido' }], [])).toBeNull();
  });
});
