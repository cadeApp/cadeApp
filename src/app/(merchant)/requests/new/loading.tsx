import { CreateRequestSkeleton } from '@/features/requests';

export default function NewRequestLoading() {
  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <CreateRequestSkeleton />
    </main>
  );
}
