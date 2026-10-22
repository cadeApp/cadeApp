import * as React from 'react';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

export function RequestOffersSkeleton() {
  return (
    <div className="flex flex-col space-y-6">
      {/* Resumen de solicitud */}
      <Card className="p-4 sm:p-6 border-border bg-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </Card>

      {/* Control de ordenamiento */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>

      {/* Tarjetas de ofertas */}
      <div className="flex flex-col space-y-3">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="flex flex-col justify-between gap-4 p-4 border-border bg-card sm:flex-row sm:items-center"
          >
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-5 w-36" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-32 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
              <div className="space-y-1">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-10 w-24 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
