import * as React from 'react';
import { redirect } from 'next/navigation';
import { VehicleForm } from '@/features/courier-onboarding';
import { createClient } from '@/server/supabase/server';
import type { VehicleType } from '@/domain/schemas';

interface PageProps {
  searchParams?: Promise<{ mode?: string }>;
}

export default async function CanonicalCourierOnboardingVehiclePage({ searchParams }: PageProps = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/courier/onboarding/vehicle');
  }

  const { data: courier } = await supabase
    .from('couriers')
    .select('vehicle_type, vehicle_plate, status')
    .eq('profile_id', user.id)
    .maybeSingle<{
      vehicle_type: VehicleType | null;
      vehicle_plate: string | null;
      status: string;
    }>();

  const resolvedParams = searchParams ? await searchParams : undefined;
  const isEditing = Boolean(courier?.vehicle_type) || resolvedParams?.mode === 'edit';

  return (
    <div className="flex flex-col items-center justify-start px-4 py-6">
      <VehicleForm
        courierId={user.id}
        isEditing={isEditing}
        initialVehicleType={courier?.vehicle_type ?? undefined}
        initialVehiclePlate={courier?.vehicle_plate ?? undefined}
        courierStatus={courier?.status}
      />
    </div>
  );
}

