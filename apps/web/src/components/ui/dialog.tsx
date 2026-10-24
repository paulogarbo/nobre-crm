'use client';

import { X } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay = 'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px]';

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl',
          className,
        )}
        {...props}
      >
        {children}
        <D.Close
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 pr-6', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof D.Title>) {
  return <D.Title className={cn('text-base font-semibold text-slate-900', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof D.Description>) {
  return <D.Description className={cn('text-sm text-slate-600', className)} {...props} />;
}

/** Sheet = Dialog ancorado à direita (detalhe da oportunidade). */
export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 shadow-2xl',
          className,
        )}
        {...props}
      >
        {children}
        <D.Close
          className="absolute right-3 top-3 rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
          aria-label="Fechar detalhe"
        >
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
