import * as React from 'react';
import { redirect } from 'next/navigation';
import { AnnouncementBanner } from '@/features/announcements';
import { getMyAnnouncement } from '@/features/announcements/server';
import { CourierFeed, type ActiveTripSummary } from '@/features/offers';
import {
  getAvailableRequests,
  getCourierStatusAndAvailability,
  getPlatformMinOfferArs,
} from '@/features/offers/server';
import { getCourierDocumentsStatus } from '@/features/courier-onboarding/server';
import { getActiveTripsForCourier } from '@/features/trips/server';
import { createClient } from '@/server/supabase/server';

/** Hotfix T-325: un repartidor `pending` ve sus documentos persistidos, igual que en la pantalla de estado. */
async function getPendingCourierDocuments() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // PR242-H03: un fallo de sesión no se muestra como «sin documentos».
  if (authError) {
    throw new Error('Error al verificar sesión del repartidor');
  }

  if (!user) {
    redirect('/login?redirectTo=/courier/feed');
  }

  return getCourierDocumentsStatus(user.id);
}

export default async function CourierFeedPage() {
  const [statusInfo, minOfferArs, feedPage, announcement] = await Promise.all([
    getCourierStatusAndAvailability(),
    getPlatformMinOfferArs(),
    getAvailableRequests(),
    getMyAnnouncement(),
  ]);

  const documents =
    statusInfo.status === 'pending' ? await getPendingCourierDocuments() : undefined;

  let activeTripsResult: { courierId: string; trips: ActiveTripSummary[] } | undefined;
  if (statusInfo.status === 'approved') {
    activeTripsResult = await getActiveTripsForCourier();
  }

  const feed = (
    <CourierFeed
      courierStatus={statusInfo.status}
      isAvailable={statusInfo.available}
      requests={feedPage.requests}
      initialNextCursor={feedPage.nextCursor}
      minOfferArs={minOfferArs}
      documents={documents}
      courierId={activeTripsResult?.courierId}
      initialActiveTrips={activeTripsResult?.trips}
    />
  );

  // T-414: la novedad vigente va arriba del feed; sin novedad, el feed se ve igual que siempre.
  if (!announcement) return feed;
  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <AnnouncementBanner key={announcement.id} announcement={announcement} />
      </div>
      {feed}
    </>
  );
}
