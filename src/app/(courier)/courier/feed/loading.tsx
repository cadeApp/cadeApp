import { Skeleton } from '@/ui/skeleton';

export default function CourierFeedLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6" aria-busy="true">
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    </div>
  );
}
