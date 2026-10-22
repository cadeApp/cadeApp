import * as React from 'react';
import { Skeleton } from '@/ui/skeleton';

export function ApplicantDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" data-testid="applicant-detail-skeleton">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-8 w-64" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="lg:col-span-3 space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
