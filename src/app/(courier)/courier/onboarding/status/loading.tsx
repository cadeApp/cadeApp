import { Skeleton } from '@/ui/skeleton';

export default function CourierStatusLoading() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 py-6 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
