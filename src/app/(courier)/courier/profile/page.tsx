import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
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
      .select('vehicle_type, vehicle_plate, license_status, insurance_status, status, dni_hmac')
      .eq('profile_id', user.id)
      .maybeSingle<{
        vehicle_type: string | null;
        vehicle_plate: string | null;
        license_status: DocumentReviewStatus;
        insurance_status: DocumentReviewStatus;
        status: CourierReviewStatus;
        dni_hmac: string | null;
      }>(),
    supabase
      .from('courier_documents')
      .select('kind, status, rejection_code, is_current')
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
  }>;
  // Solo consideramos vigentes (is_current !== false)
  const currentDocs = rawDocs.filter((d) => d.is_current !== false);

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
    dniHash: courier.dni_hmac ? `${courier.dni_hmac.slice(0, 8)}...` : null,
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
    // T-334: misma definición que el guard (`parseOnboardingComplete`): sin vehículo declarado no hay registro enviado.
    onboardingComplete: courier.vehicle_type !== null,
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
        <Link
          href="/courier/profile/notifications"
          className="flex w-full items-center justify-between rounded-xl border border-border/40 bg-card p-4 text-foreground shadow-xs transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Notificaciones y avisos</p>
              <p className="text-sm text-muted-foreground">Configurá las alertas instantáneas de pedidos</p>
            </div>
          </div>
          <span className="text-sm font-medium text-primary">Configurar →</span>
        </Link>
      </div>
    </div>
  );
}
