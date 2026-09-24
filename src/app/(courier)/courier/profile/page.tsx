import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { CourierProfileView } from '@/features/courier-onboarding';

export default async function CourierProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Lectura del perfil del repartidor
  const [profileResult, courierResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', user.id)
      .maybeSingle<{ display_name: string | null; role: string }>(),
    supabase
      .from('couriers')
      .select('vehicle_type, plate, license_status, insurance_status, status')
      .eq('profile_id', user.id)
      .maybeSingle<{
        vehicle_type: string | null;
        plate: string | null;
        license_status: string;
        insurance_status: string;
        status: string;
      }>(),
  ]);

  const profileData = {
    displayName: profileResult.data?.display_name || 'Repartidor',
    email: user.email || '',
    vehicleType: courierResult.data?.vehicle_type || 'moto',
    plate: courierResult.data?.plate || null,
    licenseStatus: courierResult.data?.license_status || 'not_uploaded',
    insuranceStatus: courierResult.data?.insurance_status || 'not_uploaded',
    courierStatus: courierResult.data?.status || 'approved',
  };

  return <CourierProfileView profile={profileData} />;
}
