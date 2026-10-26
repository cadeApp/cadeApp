'use client';

import * as React from 'react';
import type { LiveOnlineCouriersResponse } from '@/lib/live-contracts';
import { BrandLogo } from '@/ui/brand-logo';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { onlineCouriersCopy as COPY } from '../copy';
import { useOnlineCouriers } from '../hooks/use-online-couriers';

export interface OnlineCouriersIndicatorProps {
  /** Conteo leído en el servidor al renderizar la página; null si esa lectura falló. */
  readonly initial: LiveOnlineCouriersResponse | null;
  readonly className?: string;
}

/**
 * CC-041 (T-415, diseño T-417): tarjeta del inicio del comercio con cuántos repartidores están conectados ahora, para
 * saber si conviene publicar. Solo informa: con 0 aclara que puede publicar igual; si la lectura falla, «Sin datos».
 */
export function OnlineCouriersIndicator({ initial, className }: OnlineCouriersIndicatorProps) {
  const { data, isError } = useOnlineCouriers(initial);
  const count = !data || isError ? null : data.count;
  const online = count !== null && count > 0;

  return (
    <Card
      role="status"
      className={cn(
        'flex flex-col justify-between bg-card p-5 shadow-sm',
        online ? 'border-primary/40' : 'border-border',
        className
      )}
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{COPY.cardTitle}</span>
        <span
          className={cn('flex h-8 w-8 items-center justify-center rounded-lg', online ? 'bg-primary/10' : 'bg-muted')}
          aria-hidden="true"
        >
          <BrandLogo showWordmark={false} className="h-4 w-auto" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-foreground">{count ?? COPY.unavailable}</p>
      {count === 0 ? <p className="mt-1 text-sm text-muted-foreground">{COPY.cardNoneHint}</p> : null}
      {online ? <span className="sr-only">{COPY.count(count)}</span> : null}
    </Card>
  );
}
