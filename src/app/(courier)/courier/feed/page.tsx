import {
  CourierFeed,
} from '@/features/offers';
import {
  getAvailableRequests,
  getCourierStatusAndAvailability,
  getPlatformMinOfferArs,
} from '@/features/offers/server';

export default async function CourierFeedPage() {
  const [statusInfo, minOfferArs, feedPage] = await Promise.all([
    getCourierStatusAndAvailability(),
    getPlatformMinOfferArs(),
    getAvailableRequests(),
  ]);

  return (
    <CourierFeed
      courierStatus={statusInfo.status}
      isAvailable={statusInfo.available}
      requests={feedPage.requests}
      initialNextCursor={feedPage.nextCursor}
      minOfferArs={minOfferArs}
    />
  );
}
