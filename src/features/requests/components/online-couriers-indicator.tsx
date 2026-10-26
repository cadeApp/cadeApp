'use client';

import * as React from 'react';
import { Bike, Info } from 'lucide-react';
import type { LiveOnlineCouriersResponse } from '@/lib/live-contracts';
import { cn } from '@/ui/cn';
import { onlineCouriersCopy as COPY } from '../copy';
import { useOnlineCouriers } from '../hooks/use-online-couriers';

export interface OnlineCouriersIndicatorProps {
  /** Conteo leído en el servidor al renderizar la página; null si esa lectura falló. */
  readonly initial: LiveOnlineCouriersResponse | null;
  readonly className?: string;
}

/**
 * CC-041 (T-415): cuántos repartidores están conectados ahora, para que el comercio sepa si conviene publicar. Solo
 * informa: con 0 aclara que puede publicar igual. Si la lectura falla, no muestra nada.
 */
export function OnlineCouriersIndicator({ initial, className }: OnlineCouriersIndicatorProps) {
  const { data, isError } = useOnlineCouriers(initial);
  if (!data || isError) return null;

  if (data.count === 0) {
    return (
      <div
        role="status"
        className={cn('flex items-start gap-3 rounded-lg border border-border bg-muted/60 px-3.5 py-3', className)}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-0.5 text-sm">
          <p className="font-semibold text-foreground">{COPY.noneTitle}</p>
          <p className="text-muted-foreground">{COPY.noneDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn('flex items-center gap-2.5 rounded-lg bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-foreground', className)}
    >
      <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <Bike className="h-4 w-4 shrink-0 text-primary-dark" aria-hidden="true" />
      <span>{COPY.count(data.count)}</span>
    </div>
  );
}
