import * as React from 'react';
import { VehicleForm } from '@/features/courier-onboarding';
import { createClient } from '@/server/supabase/server';

export default async function CourierOnboardingVehiclePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-start items-center">
      <VehicleForm courierId={user?.id || 'temp-courier'} />
    </main>
  );
}
