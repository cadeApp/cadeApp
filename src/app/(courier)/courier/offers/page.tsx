import { MyOffersList } from '@/features/offers';
import { getMyOffers } from '@/features/offers/server';

export default async function CourierOffersPage() {
  const offers = await getMyOffers();

  return <MyOffersList initialOffers={offers} />;
}
