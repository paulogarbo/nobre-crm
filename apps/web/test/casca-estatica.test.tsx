import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/layout/Providers';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('casca estática (antes da hidratação)', () => {
  it('o HTML do servidor traz a moldura e o skeleton, não a página nem uma tela vazia', () => {
    const html = renderToString(
      <Providers>
        <p>conteúdo que depende do navegador</p>
      </Providers>,
    );
    expect(html).toContain('Nobre CRM');
    expect(html).toContain('Kanban');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('conteúdo que depende do navegador');
  });
});
