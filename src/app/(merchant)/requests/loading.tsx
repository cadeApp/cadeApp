import { MerchantRequestsSkeleton } from '@/features/requests';

export default function MerchantRequestsLoading() {
  return (
    <main className="min-h-screen px-4 py-6 sm:py-8 max-w-4xl mx-auto">
      <MerchantRequestsSkeleton />
    </main>
  );
}
