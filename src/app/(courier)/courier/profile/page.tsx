import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import {
  CourierProfileView,
  combineDniDocumentStatus,
  type CourierProfileData,
  type DocumentReviewStatus,
  type CourierReviewStatus,
} from '@/features/courier-onboarding';

export default async function CourierProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Error de sesión al consultar perfil de repartidor: ${authError.message}`);
  }

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
        license_status: DocumentReviewStatus;
        insurance_status: DocumentReviewStatus;
        status: CourierReviewStatus;
      }>(),
    supabase.from('courier_documents').select('kind, status').eq('courier_id', user.id),
  ]);

  if (profileResult.error) {
    throw new Error(`Error al consultar perfil de usuario: ${profileResult.error.message}`);
  }

  if (courierResult.error) {
    throw new Error(`Error al consultar legajo de repartidor: ${courierResult.error.message}`);
  }

  if (docsResult.error) {
    throw new Error(`Error al consultar documentos de repartidor: ${docsResult.error.message}`);
  }

  const courier = courierResult.data;
  if (!courier) {
    return <CourierProfileView profile={null} />;
  }

  const docs = (docsResult.data ?? []) as Array<{ kind: string; status: DocumentReviewStatus }>;
  const dniFront: DocumentReviewStatus = docs.find((d) => d.kind === 'dni_front')?.status ?? 'none';
  const dniBack: DocumentReviewStatus = docs.find((d) => d.kind === 'dni_back')?.status ?? 'none';
  const selfie: DocumentReviewStatus = docs.find((d) => d.kind === 'selfie')?.status ?? 'none';

  const dniStatus = combineDniDocumentStatus(dniFront, dniBack);

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
