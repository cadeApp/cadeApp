import { getPublicationPlans } from '@/features/admin/server';
import { ADMIN_COPY, PublicationPlansManager } from '@/features/admin';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { Card } from '@/ui/card';

export const metadata = {
  title: 'Catálogo de planes | cadeApp Admin',
  description: 'Planes de publicación que se registran a los comercios',
};

export default async function PublicationPlansPage() {
  const plans = await getPublicationPlans();
  if (!plans.ok) {
    return (
      <Card role="alert" className="mx-auto max-w-2xl space-y-2 p-6 text-center">
        <h1 className="text-lg font-bold text-foreground">{ADMIN_COPY.plans.loadError}</h1>
        <p className="text-sm text-muted-foreground">{getDomainErrorMessage(plans.code)}</p>
      </Card>
    );
  }
  return <PublicationPlansManager plans={plans.data} />;
}
