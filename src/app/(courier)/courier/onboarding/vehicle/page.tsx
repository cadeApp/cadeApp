import * as React from 'react';
import { redirect } from 'next/navigation';
import { VehicleForm } from '@/features/courier-onboarding';
import { createClient } from '@/server/supabase/server';

export default async function CanonicalCourierOnboardingVehiclePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/courier/onboarding/vehicle');
  }

  return (
    <div className="flex flex-col items-center justify-start px-4 py-6">
      <VehicleForm courierId={user.id} />
    </div>
  );
}
