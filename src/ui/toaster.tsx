'use client';

import { Toaster as SonnerToaster } from 'sonner';

/**
 * Único `<Toaster />` montado en `src/app/providers.tsx` (Regla 60).
 * Posición y duración centralizadas.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            'rounded-xl border border-border bg-card text-card-foreground font-sans text-sm shadow-lg',
          title: 'font-semibold text-sm text-foreground',
          description: 'text-sm text-muted-foreground',
        },
      }}
    />
  );
}
