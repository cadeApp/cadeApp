import * as React from 'react';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

export function MerchantRequestsSkeleton() {
  return (
    <div className="flex flex-col space-y-6">
      {/* Encabezado y Acción */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-12 w-40 rounded-lg" />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tarjetas de Solicitudes */}
      <div className="flex flex-col space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 border-border bg-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-28 rounded-lg self-end sm:self-center" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
