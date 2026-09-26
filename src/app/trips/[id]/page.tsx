import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getTripDetails } from '@/features/trips/server';
import { TripMerchantContainer, TripCourierContainer } from '@/features/trips';

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (profileError || !profile) {
    notFound();
  }

  const trip = await getTripDetails(id);
  if (!trip) {
    notFound();
  }

  if (profile.role === 'merchant') {
    if (trip.merchantId !== user.id) {
      notFound();
    }
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-4">
        <TripMerchantContainer trip={trip} />
      </div>
    );
  }

  if (profile.role === 'courier') {
    if (trip.courierId !== user.id) {
      notFound();
    }
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-4">
        <TripCourierContainer trip={trip} />
      </div>
    );
  }

  notFound();
}
