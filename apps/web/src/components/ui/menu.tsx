'use client';

import { ChevronRight } from 'lucide-react';
import { DropdownMenu as M, Tooltip as T } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------- Tooltip ----------

export const TooltipProvider = T.Provider;

export function Tooltip({
  conteudo,
  children,
  lado = 'top',
}: {
  conteudo: React.ReactNode;
  children: React.ReactNode;
  lado?: 'top' | 'right' | 'bottom' | 'left';
}) {
  if (!conteudo) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={lado}
          sideOffset={6}
          className="z-[60] max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg"
        >
          {conteudo}
          <T.Arrow className="fill-slate-900" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

// ---------- DropdownMenu ----------

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuSub = M.Sub;

const painel = 'z-50 min-w-48 rounded-lg border border-slate-200 bg-white p-1 text-sm text-slate-800 shadow-lg';
const item =
  'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-slate-100 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-slate-500';

export function MenuContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content sideOffset={4} align="end" className={cn(painel, className)} {...props} />
    </M.Portal>
  );
}

export function MenuItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof M.Item>) {
  return <M.Item className={cn(item, className)} {...props} />;
}

export function MenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof M.Label>) {
  return <M.Label className={cn('px-2 py-1 text-xs font-medium text-slate-500', className)} {...props} />;
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-slate-200" />;
}

export function MenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof M.SubTrigger>) {
  return (
    <M.SubTrigger className={cn(item, 'data-[state=open]:bg-slate-100', className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" />
    </M.SubTrigger>
  );
}

export function MenuSubContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent sideOffset={6} className={cn(painel, className)} {...props} />
    </M.Portal>
  );
}
