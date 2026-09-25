import { Skeleton } from '@/ui/skeleton';

export default function CourierOffersLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-44" />
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}
