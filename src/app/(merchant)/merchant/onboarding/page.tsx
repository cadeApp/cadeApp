import { MerchantOnboardingForm } from '@/features/merchants';
import { getActiveZones } from '@/features/merchants/server';

export default async function MerchantOnboardingPage() {
  const zones = await getActiveZones();

  return (
    <div className="px-4 py-6">
      <MerchantOnboardingForm zones={zones} />
    </div>
  );
}
