import * as React from 'react';
import { redirect } from 'next/navigation';
import { NotificationsSettingsLink, PUSH_COPY } from '@/features/notifications';
import { createClient } from '@/server/supabase/server';
import {
  CourierProfileView,
  combineDniDocumentStatus,
  type CourierProfileData,
  type DocumentReviewStatus,
  type CourierReviewStatus,
} from '@/features/courier-onboarding';
import { getCourierApprovedAvatarUrl } from '@/features/courier-onboarding/server';


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
      .select('display_name, role, phone')
      .eq('id', user.id)
      .maybeSingle<{ display_name: string | null; role: string; phone: string | null }>(),
    supabase
      .from('couriers')
      .select('vehicle_type, vehicle_plate, license_status, insurance_status, status, dni_hmac, application_submitted, active_vehicle_id')
      .eq('profile_id', user.id)
      .maybeSingle<{
        active_vehicle_id: string | null;
        vehicle_type: string | null;
        vehicle_plate: string | null;
        license_status: DocumentReviewStatus;
        insurance_status: DocumentReviewStatus;
        status: CourierReviewStatus;
        dni_hmac: string | null;
        application_submitted: boolean;
      }>(),
    supabase
      .from('courier_documents')
      .select('kind, status, rejection_code, is_current, vehicle_id')
      .eq('courier_id', user.id),
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

  const rawDocs = (docsResult.data ?? []) as Array<{
    kind: string;
    status: DocumentReviewStatus;
    rejection_code?: string | null;
    is_current?: boolean;
    vehicle_id?: string | null;
  }>;
  // Solo consideramos vigentes (is_current !== false); CC-042: licencia y seguro del vehículo activo, o los que todavía
  // no tienen vehículo si no hay activo (misma regla que isActiveVehicleDocument, PR624-H05).
  const currentDocs = rawDocs.filter((d) => {
    if (d.is_current === false) return false;
    if (d.kind !== 'license' && d.kind !== 'insurance') return true;
    return courier.active_vehicle_id === null ? !d.vehicle_id : d.vehicle_id === courier.active_vehicle_id;
  });

  const docsMap = new Map<string, (typeof rawDocs)[number]>();
  for (const doc of currentDocs) {
    if (!docsMap.has(doc.kind)) {
      docsMap.set(doc.kind, doc);
    }
  }

  const dniFrontDoc = docsMap.get('dni_front');
  const dniBackDoc = docsMap.get('dni_back');
  const selfieDoc = docsMap.get('selfie');
  const licenseDoc = docsMap.get('license');
  const insuranceDoc = docsMap.get('insurance');
  const avatarDoc = docsMap.get('avatar');

  const dniFrontStatus: DocumentReviewStatus = dniFrontDoc?.status ?? 'none';
  const dniBackStatus: DocumentReviewStatus = dniBackDoc?.status ?? 'none';
  const selfieStatus: DocumentReviewStatus = selfieDoc?.status ?? 'none';
  const licenseStatus: DocumentReviewStatus = licenseDoc?.status ?? 'none';
  const insuranceStatus: DocumentReviewStatus = insuranceDoc?.status ?? 'none';
  const avatarStatus: DocumentReviewStatus = avatarDoc?.status ?? 'none';

  let avatarUrl: string | null = null;
  if (courier.status === 'approved' && avatarStatus === 'verified') {
    try {
      avatarUrl = await getCourierApprovedAvatarUrl(user.id, { client: supabase });
    } catch {
      avatarUrl = null;
    }
  }

  const dniStatus = combineDniDocumentStatus(dniFrontStatus, dniBackStatus);

  const profileData: CourierProfileData = {
    courierId: user.id,
    displayName: profileResult.data?.display_name ?? 'Sin nombre registrado',
    email: user.email ?? '',
    phone: profileResult.data?.phone ?? null,
    hasDniOnFile: Boolean(courier.dni_hmac),
    vehicleType: courier.vehicle_type,
    plate: courier.vehicle_plate,
    avatarUrl,
    avatarStatus,
    dniStatus,
    dniFrontStatus,
    dniFrontRejectionMessage:
      dniFrontDoc?.status === 'rejected'
        ? (await import('@/features/courier-onboarding/copy')).getSafeRejectionMessage(
            dniFrontDoc.rejection_code
          )
        : null,
    dniBackStatus,
    dniBackRejectionMessage:
      dniBackDoc?.status === 'rejected'
        ? (await import('@/features/courier-onboarding/copy')).getSafeRejectionMessage(
            dniBackDoc.rejection_code
          )
        : null,
    selfieStatus,
    selfieRejectionMessage:
      selfieDoc?.status === 'rejected'
        ? (await import('@/features/courier-onboarding/copy')).getSafeRejectionMessage(
            selfieDoc.rejection_code
          )
        : null,
    licenseStatus,
    licenseRejectionMessage:
      licenseDoc?.status === 'rejected'
        ? (await import('@/features/courier-onboarding/copy')).getSafeRejectionMessage(
            licenseDoc.rejection_code
          )
        : null,
    insuranceStatus,
    insuranceRejectionMessage:
      insuranceDoc?.status === 'rejected'
        ? (await import('@/features/courier-onboarding/copy')).getSafeRejectionMessage(
            insuranceDoc.rejection_code
          )
        : null,
    courierStatus: courier.status,
    // CC-043: misma definición que el guard (`parseOnboardingComplete`): sin postulación enviada no hay registro.
    onboardingComplete: courier.application_submitted === true,
    documents: currentDocs.map((d) => ({
      kind: d.kind as import('@/domain/schemas').CourierDocumentKind,
      status: d.status,
      rejectionCode: d.status === 'rejected' ? d.rejection_code ?? null : null,
    })),
  };

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col pb-8">
      <CourierProfileView profile={profileData} />
      <div className="px-4 mt-2">
        <NotificationsSettingsLink href="/courier/profile/notifications" {...PUSH_COPY.profileLink} />
      </div>
    </div>
  );
}
