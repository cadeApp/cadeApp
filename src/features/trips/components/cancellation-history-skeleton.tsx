import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

/** T-373: misma forma que la sección de historial (título, descripción y dos eventos). */
export function CancellationHistorySkeleton() {
  return (
    <Card aria-busy="true" aria-label="Cargando historial de asignaciones">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[0, 1].map((key) => (
          <div key={key} className="space-y-2 rounded-lg border border-border p-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-52" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
