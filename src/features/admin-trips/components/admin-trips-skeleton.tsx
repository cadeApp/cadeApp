import * as React from 'react';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { ADMIN_TRIPS_COPY } from '../copy';

/** T-410: imita título, pestañas y filas de la lista para que la pantalla no salte al llegar los datos. */
export function AdminTripsListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{ADMIN_TRIPS_COPY.list.loading}</span>
      <div data-skeleton="title" className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        <div data-skeleton="tab">
          <Skeleton className="h-10 w-32" />
        </div>
        <div data-skeleton="tab">
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <Card key={row} data-skeleton="row" className="flex flex-col gap-3 p-4 sm:flex-row sm:justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-56" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-40 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-12 w-full sm:w-28" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/** T-410: imita el detalle (encabezado, entregas, cronología, partes e incidentes). */
export function AdminTripDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{ADMIN_TRIPS_COPY.detail.loading}</span>
      <div data-skeleton="title" className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card data-skeleton="drops" className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </Card>
          <Card data-skeleton="timeline" className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </Card>
        </div>
        <div className="space-y-6">
          <Card data-skeleton="parties" className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </Card>
          <Card data-skeleton="incidents" className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}
