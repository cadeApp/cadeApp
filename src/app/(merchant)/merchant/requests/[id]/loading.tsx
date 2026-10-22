import { Skeleton } from '@/ui/skeleton';

export default function MerchantRequestDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
