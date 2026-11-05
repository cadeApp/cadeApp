import * as React from 'react';
import { Skeleton } from '@/ui/skeleton';

export function ApplicantsQueueSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" data-testid="applicants-queue-skeleton">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48" />
          {/* T-403: contador «N pendientes» */}
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-col gap-3 border-b border-border pb-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        {/* T-403: «Buscar por nombre» y su botón */}
        <div className="flex gap-2">
          <Skeleton className="h-12 w-full rounded-lg lg:w-72" />
          <Skeleton className="h-12 w-24 rounded-lg" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}
