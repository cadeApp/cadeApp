'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button, buttonVariants, cn } from '@/ui';

export interface ErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorView({ error, reset }: ErrorViewProps) {
  const supportCode = useMemo(() => {
    if (error.digest) {
      return error.digest.slice(0, 8).toUpperCase();
    }
    // Generar un código determinista corto sin exponer datos sensibles
    let hash = 0;
    const str = error.message || 'error';
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).slice(0, 4).toUpperCase() || '5F2A';
  }, [error]);

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mx-auto w-full max-w-md">
        {/* Motivo gráfico de ruta ondulada interrumpida (T04) */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-10 w-10" aria-hidden="true" />
        </div>

        {/* Onda decorativa SVG (wavy-accent) */}
        <div className="mx-auto mb-6 h-3 w-32 text-destructive/40" aria-hidden="true">
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
          Algo salió mal
        </h1>

        <p className="mt-3 text-sm text-muted-foreground sm:text-base leading-relaxed">
          No es tu culpa. Probá de nuevo en unos segundos.
        </p>

        <div className="mt-4">
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 font-mono text-sm text-muted-foreground">
            Código: {supportCode}
          </span>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="default"
            className="h-12 w-full text-base font-semibold sm:w-auto sm:min-w-[140px]"
            onClick={() => reset()}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>

          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-12 w-full text-base text-muted-foreground hover:text-foreground sm:w-auto sm:min-w-[140px]'
            )}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
