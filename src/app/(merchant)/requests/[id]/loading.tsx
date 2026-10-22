import { RequestOffersSkeleton } from '@/features/requests';

export default function MerchantRequestDetailLoading() {
  return (
    <main className="min-h-screen px-4 py-6 sm:py-8 max-w-3xl mx-auto">
      <RequestOffersSkeleton />
    </main>
  );
}
