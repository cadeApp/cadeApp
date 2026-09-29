import { Skeleton } from '@/ui/skeleton';

export default function LegalLoading() {
  return (
    <main
      className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6"
      aria-label="Cargando documento legal"
    >
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </main>
  );
}
