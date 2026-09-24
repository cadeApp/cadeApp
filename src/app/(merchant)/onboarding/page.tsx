import { MerchantOnboardingForm } from '@/features/merchants';
import { getActiveZones } from '@/features/merchants/server';

export default async function MerchantOnboardingPage() {
  const zones = await getActiveZones();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 py-8">
      <MerchantOnboardingForm zones={zones} />
    </main>
  );
}
