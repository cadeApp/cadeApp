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
  } = await supabase.auth.getUser();

  return user ? getCourierDocumentsStatus(user.id) : [];
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
