import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { CourierProfileView, type CourierProfileData } from '@/features/courier-onboarding';

export default async function CourierProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [profileResult, courierResult, docsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', user.id)
      .maybeSingle<{ display_name: string | null; role: string }>(),
    supabase
      .from('couriers')
      .select('vehicle_type, vehicle_plate, license_status, insurance_status, status')
      .eq('profile_id', user.id)
      .maybeSingle<{
        vehicle_type: string | null;
        vehicle_plate: string | null;
        license_status: string;
        insurance_status: string;
        status: string;
      }>(),
    supabase
      .from('courier_documents')
      .select('kind, status')
      .eq('courier_id', user.id),
  ]);

  const courier = courierResult.data;
  if (!courier) {
    return <CourierProfileView profile={null} />;
  }

  const docs = (docsResult.data ?? []) as Array<{ kind: string; status: string }>;
  const dniFront = docs.find((d) => d.kind === 'dni_front')?.status ?? 'none';
  const dniBack = docs.find((d) => d.kind === 'dni_back')?.status ?? 'none';
  const selfie = docs.find((d) => d.kind === 'selfie')?.status ?? 'none';

  const dniStatus =
    dniFront === dniBack
      ? dniFront
      : dniFront === 'rejected' || dniBack === 'rejected'
        ? 'rejected'
        : dniFront === 'pending' || dniBack === 'pending'
          ? 'pending'
          : 'none';

  const profileData: CourierProfileData = {
    displayName: profileResult.data?.display_name ?? 'Sin nombre registrado',
    email: user.email ?? '',
    vehicleType: courier.vehicle_type,
    plate: courier.vehicle_plate,
    dniStatus,
    selfieStatus: selfie,
    licenseStatus: courier.license_status,
    insuranceStatus: courier.insurance_status,
    courierStatus: courier.status,
  };

  return <CourierProfileView profile={profileData} />;
}
