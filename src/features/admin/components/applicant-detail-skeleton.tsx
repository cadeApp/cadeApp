import * as React from 'react';
import { Skeleton } from '@/ui/skeleton';

/** T-404 (A02): visor a la izquierda (60 %), datos, consentimientos e historial a la derecha, barra de acciones. */
export function ApplicantDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" data-testid="applicant-detail-skeleton">
      <div className="space-y-2 border-b border-border pb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border py-3">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>
    </div>
  );
}
