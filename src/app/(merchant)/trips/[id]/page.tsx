import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getTripDetails } from '@/features/trips/server';
import { TripMerchantContainer } from '@/features/trips';

interface MerchantTripPageProps {
  params: Promise<{ id: string }>;
}

export default async function MerchantTripDetailPage({ params }: MerchantTripPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const trip = await getTripDetails(id);

  if (!trip || trip.merchantId !== user.id) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-4">
      <TripMerchantContainer trip={trip} />
    </div>
  );
}
