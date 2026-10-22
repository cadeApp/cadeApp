import { getAdminMerchants, parseAdminMerchantsSearchParams } from '@/features/admin/server';
import { MerchantsTable } from '@/features/admin';

export const metadata = {
  title: 'Comercios | cadeApp Admin',
  description: 'Plan y vigencia de los comercios adheridos en Aguilares',
};

interface MerchantsPageProps {
  searchParams: Promise<{ cursor?: string | string[] }>;
}

export default async function MerchantsPage({ searchParams }: MerchantsPageProps) {
  const { cursor } = parseAdminMerchantsSearchParams(await searchParams);
  const result = await getAdminMerchants({ cursor, pageSize: 20 });

  return <MerchantsTable result={result} currentCursor={cursor} />;
}
