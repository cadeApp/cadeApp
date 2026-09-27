// eslint-disable-next-line boundaries/entry-point
import { MyOffersList } from '@/features/offers/components/my-offers-list';
import { getMyOffers } from '@/features/offers/server';

export default async function CourierOffersPage() {
  const offers = await getMyOffers();

  return <MyOffersList initialOffers={offers} />;
}
