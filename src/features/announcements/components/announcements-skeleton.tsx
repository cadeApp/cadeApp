import * as React from 'react';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { ANNOUNCEMENTS_COPY } from '../copy';

/** T-414: carga de `/admin/announcements` con la forma final (formulario, vista previa e historial). */
export function AnnouncementsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label={ANNOUNCEMENTS_COPY.admin.loadingLabel}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5 sm:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-40" />
        </Card>
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
