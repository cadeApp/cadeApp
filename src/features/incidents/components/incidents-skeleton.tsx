import * as React from 'react';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { INCIDENTS_COPY } from '../copy';

/** A05: imita título, pestañas y tarjetas de la bandeja para que la pantalla no salte al llegar los datos. */
export function IncidentsInboxSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{INCIDENTS_COPY.inbox.loading}</span>
      <div data-skeleton="title" className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        <div data-skeleton="tab">
          <Skeleton className="h-10 w-24" />
        </div>
        <div data-skeleton="tab">
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <Card key={row} data-skeleton="row" className="flex flex-col gap-3 p-4 sm:flex-row sm:justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-12 w-full sm:w-28" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/** A05: imita el detalle (relato, cronología, partes y panel de resolución). */
export function IncidentDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{INCIDENTS_COPY.detail.loading}</span>
      <div data-skeleton="title" className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card data-skeleton="story" className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </Card>
          <Card data-skeleton="timeline" className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-10 w-56" />
          </Card>
          <Card data-skeleton="parties" className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </Card>
        </div>
        <Card data-skeleton="actions" className="h-fit space-y-3 p-4 sm:p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    </div>
  );
}
