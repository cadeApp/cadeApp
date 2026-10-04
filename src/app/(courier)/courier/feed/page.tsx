import * as React from 'react';
import { redirect } from 'next/navigation';
import { CourierFeed } from '@/features/offers';
import {
  getAvailableRequests,
  getCourierStatusAndAvailability,
  getPlatformMinOfferArs,
} from '@/features/offers/server';
import { getCourierDocumentsStatus } from '@/features/courier-onboarding/server';
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
  const [statusInfo, minOfferArs, feedPage] = await Promise.all([
    getCourierStatusAndAvailability(),
    getPlatformMinOfferArs(),
    getAvailableRequests(),
  ]);

  const documents =
    statusInfo.status === 'pending' ? await getPendingCourierDocuments() : undefined;

  return (
    <CourierFeed
      courierStatus={statusInfo.status}
      isAvailable={statusInfo.available}
      requests={feedPage.requests}
      initialNextCursor={feedPage.nextCursor}
      minOfferArs={minOfferArs}
      documents={documents}
    />
  );
}
