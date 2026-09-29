import { Skeleton } from '@/ui/skeleton';

export function CreateRequestSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-6 pb-12" data-testid="create-request-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>

      {/* Retiro */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-6 w-36" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>

      {/* Entrega */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>

      {/* Paquete */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-6 w-36" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>

      {/* Pago */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-6 w-44" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>

      {/* Botón */}
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
