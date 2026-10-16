import { MerchantOnboardingForm } from '@/features/merchants';
import { getActiveZones, getMerchantProfileForEdit } from '@/features/merchants/server';

export default async function MerchantOnboardingPage() {
  const [zones, initialData] = await Promise.all([
    getActiveZones(),
    getMerchantProfileForEdit(),
  ]);

  return (
    <div className="px-4 py-6">
      <MerchantOnboardingForm zones={zones} initialData={initialData} />
    </div>
  );
}
