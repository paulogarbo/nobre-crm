import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { Providers } from '@/components/layout/Providers';
import { Topbar } from '@/components/layout/Topbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nobre CRM · Brindes',
  description: 'Funil comercial da Nobre Brindes: o que trabalhar hoje.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>
          <Suspense>
            <Topbar />
          </Suspense>
          <main className="mx-auto max-w-[1800px] px-4 py-4">
            <Suspense>{children}</Suspense>
          </main>
        </Providers>
      </body>
    </html>
  );
}
