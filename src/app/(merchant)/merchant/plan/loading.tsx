import { Skeleton } from '@/ui/skeleton';

export default function MerchantPlanLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
