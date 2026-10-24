'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AcoesOportunidadeProvider } from '@/components/oportunidade/AcoesOportunidade';
import { TooltipProvider } from '@/components/ui/menu';

const semAssinatura = () => () => {};

/**
 * Sem SSR de dados (decisão do projeto): a interface depende da identidade guardada no navegador e de
 * consultas à API, então só renderiza no cliente. Evita divergência de hidratação entre topbar e página.
 */
function useNoCliente() {
  return useSyncExternalStore(semAssinatura, () => true, () => false);
}

export function Providers({ children }: { children: ReactNode }) {
  const noCliente = useNoCliente();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        {noCliente && <AcoesOportunidadeProvider>{children}</AcoesOportunidadeProvider>}
        <Toaster position="bottom-right" richColors closeButton duration={5000} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
