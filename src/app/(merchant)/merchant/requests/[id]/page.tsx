import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getMerchantRequestWithOffers } from '@/features/requests/server';
import { RequestOffersList } from '@/features/requests';

interface MerchantRequestDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CanonicalMerchantRequestDetailPage({
  params,
}: MerchantRequestDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const result = await getMerchantRequestWithOffers(id, user.id);

  if (!result) {
    notFound();
  }

  return (
    <div className="px-4 py-4">
      <RequestOffersList
        request={result.request}
        initialOffers={result.offers}
        initialNextCursor={result.nextOffersCursor}
      />
    </div>
  );
}
