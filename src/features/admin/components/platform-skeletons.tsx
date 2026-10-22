import * as React from 'react';
import { Skeleton } from '@/ui/skeleton';

/** A03: imita encabezado + tabla de comercios. */
export function MerchantsTableSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" data-testid="merchants-table-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
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

/** A04: imita la lista de cinco parámetros y el panel lateral de últimos cambios. */
export function PlatformSettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" data-testid="platform-settings-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** CC-029: imita resumen de saldo, lotes y libro de un comercio. */
export function MerchantCreditsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" data-testid="merchant-credits-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}

/** CC-029: imita encabezado y tabla del catálogo de planes. */
export function PublicationPlansSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" data-testid="publication-plans-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** A06: imita encabezado, filtros y tabla de auditoría. */
export function AuditLogSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" data-testid="audit-log-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
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
