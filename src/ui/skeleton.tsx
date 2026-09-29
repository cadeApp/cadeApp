import * as React from 'react';
import { cn } from './cn';
import { Card } from './card';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Bloque de carga `Skeleton` de `src/ui`.
 * Toda espera visible usa `Skeleton` imitando la forma final para evitar saltos de layout.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-muted', className)}
      {...props}
    />
  );
}

/**
 * Skeleton de referencia que imita la forma exacta de una tarjeta de solicitud (S00).
 */
export function RequestCardSkeleton() {
  return (
    <Card className="p-4" aria-busy="true" aria-label="Cargando solicitud">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-56" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-12 w-28 rounded-lg" />
      </div>
    </Card>
  );
}

export const SkeletonRequestCard = RequestCardSkeleton;

