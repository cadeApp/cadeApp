import * as React from 'react';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

export function FeedSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando solicitudes">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4 shadow-sm space-y-3">
          {/* Ruta */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-6 w-52" />
          </div>
          {/* Línea de detalle */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          {/* Línea de pago */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          {/* Vencimiento */}
          <Skeleton className="h-4 w-40" />
          {/* Botón */}
          <Skeleton className="h-12 w-full rounded-lg" />
        </Card>
      ))}
    </div>
  );
}
