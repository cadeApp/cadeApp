import {
  getAdminMerchants,
  getMerchantStatusCounts,
  parseAdminMerchantsSearchParams,
} from '@/features/admin/server';
import { MerchantsTable } from '@/features/admin';

export const metadata = {
  title: 'Comercios | cadeApp Admin',
  description: 'Plan y vigencia de los comercios adheridos en Aguilares',
};

interface MerchantsPageProps {
  searchParams: Promise<{ cursor?: string | string[]; status?: string | string[] }>;
}

export default async function MerchantsPage({ searchParams }: MerchantsPageProps) {
  const { cursor, status } = parseAdminMerchantsSearchParams(await searchParams);
  const [result, counts] = await Promise.all([
    getAdminMerchants({ cursor, status, pageSize: 20 }),
    getMerchantStatusCounts(),
  ]);

  return <MerchantsTable result={result} currentCursor={cursor} counts={counts} status={status} />;
}
