import React from 'react';
import { Compass, Home } from 'lucide-react';
import { buttonVariants } from '@/ui/button';
import { cn } from '@/ui/cn';

export function NotFoundView() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mx-auto w-full max-w-md">
        {/* Ícono institucional / decorativo */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
          <Compass className="h-10 w-10" aria-hidden="true" />
        </div>

        {/* Onda decorativa SVG (wavy-accent) */}
        <div className="mx-auto mb-6 h-3 w-32 text-brand-teal/40" aria-hidden="true">
          <svg viewBox="0 0 120 12" fill="none" className="h-full w-full">
            <path
              d="M0 6 Q 15 0, 30 6 T 60 6 T 90 6 T 120 6"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Página no encontrada
        </h1>

        <p className="mt-3 text-sm text-muted-foreground sm:text-base leading-relaxed">
          No encontramos lo que buscabas. Es posible que el enlace haya cambiado o que la pantalla ya no esté disponible.
        </p>

        <div className="mt-8 flex justify-center">
          <a
            href="/login"
            className={cn(
              buttonVariants({ variant: 'default' }),
              'h-12 w-full text-base font-semibold sm:w-auto sm:min-w-[160px]'
            )}
          >
            <Home className="mr-2 h-4 w-4" aria-hidden="true" />
            Ir al inicio
          </a>
        </div>
      </div>
    </main>
  );
}
