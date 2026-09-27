import * as React from 'react';
import { Skeleton } from '@/ui/skeleton';
import { cn } from '@/ui/cn';

export interface MapSkeletonProps {
  className?: string;
  heightClass?: string;
}

export function MapSkeleton({ className, heightClass = 'h-64 sm:h-72' }: MapSkeletonProps) {
  return (
    <div
      data-testid="map-skeleton"
      className={cn(
        'relative flex w-full flex-col justify-between overflow-hidden rounded-xl border border-border bg-muted/40 p-4',
        heightClass,
        className
      )}
      aria-label="Cargando mapa..."
      role="status"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="flex items-center justify-center">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-44" />
        <div className="grid grid-cols-3 gap-1">
          <Skeleton className="col-start-2 h-7 w-7 rounded-md" />
          <Skeleton className="col-start-1 h-7 w-7 rounded-md" />
          <Skeleton className="col-start-2 h-7 w-7 rounded-md" />
          <Skeleton className="col-start-3 h-7 w-7 rounded-md" />
        </div>
      </div>
    </div>
  );
}
