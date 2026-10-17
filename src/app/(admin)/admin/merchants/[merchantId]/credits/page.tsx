import { notFound } from 'next/navigation';
import {
  getAdminMerchantHeader,
  getAdminMerchantPublicationCredits,
  getPublicationPlans,
  parseMerchantCreditsParams,
} from '@/features/admin/server';
import { ADMIN_COPY, MerchantCreditsView } from '@/features/admin';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { Card } from '@/ui/card';

export const metadata = {
  title: 'Créditos del comercio | cadeApp Admin',
  description: 'Saldo, plan y libro de créditos de publicación de un comercio',
};

interface MerchantCreditsPageProps {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{ before?: string | string[] }>;
}

export default async function MerchantCreditsPage({ params, searchParams }: MerchantCreditsPageProps) {
  const [{ merchantId: rawMerchantId }, { before }] = await Promise.all([params, searchParams]);
  const { merchantId, beforeId } = parseMerchantCreditsParams({ merchantId: rawMerchantId, before });
  if (!merchantId) notFound();

  const [merchant, credits, plans] = await Promise.all([
    getAdminMerchantHeader(merchantId),
    getAdminMerchantPublicationCredits({ merchantId, beforeId }),
    getPublicationPlans(),
  ]);
  if (!merchant) notFound();

  if (!credits.ok) {
    return (
      <Card role="alert" className="mx-auto max-w-2xl space-y-2 p-6 text-center">
        <h1 className="text-lg font-bold text-foreground">{ADMIN_COPY.credits.loadError}</h1>
        <p className="text-sm text-muted-foreground">{getDomainErrorMessage(credits.code)}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!plans.ok ? (
        <Card role="alert" className="p-4 text-sm text-destructive">
          {ADMIN_COPY.plans.loadError} {getDomainErrorMessage(plans.code)}
        </Card>
      ) : null}
      <MerchantCreditsView
        merchant={merchant}
        data={credits.data}
        plans={plans.ok ? plans.data : []}
        currentBeforeId={beforeId}
      />
    </div>
  );
}
