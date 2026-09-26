'use client';

import React from 'react';
import { Skeleton } from '@/ui/skeleton';

export function TripSkeleton() {
  return (
    <div data-testid="trip-skeleton" className="space-y-4 p-4 max-w-[390px] mx-auto">
      {/* Stepper skeleton */}
      <div className="flex items-center justify-between gap-2 p-3 bg-muted/40 rounded-xl">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-0.5 flex-1" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-0.5 flex-1" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Main card skeleton */}
      <div className="rounded-xl border border-border p-4 space-y-3 bg-card">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
