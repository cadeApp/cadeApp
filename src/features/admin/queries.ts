import { createAdminClient } from '@/server/supabase/admin';
import type {
  AdminApplicantTab,
  ApplicantDetail,
  ApplicantDocumentDetail,
  ApplicantListItem,
  CourierDocLevel,
} from './types';

interface ProfileRow {
  display_name: string | null;
  phone: string | null;
  created_at: string;
}

interface CourierDocRow {
  kind: string;
  status: string;
}

interface CourierQueueRow {
  profile_id: string;
  status: string;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  dni_hmac: string | null;
  doc_level: number | null;
  license_status: string | null;
  insurance_status: string | null;
  profiles: ProfileRow | null;
  courier_documents: CourierDocRow[] | null;
}

interface CourierDetailRow {
  profile_id: string;
  status: string;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  dni_hmac: string | null;
  doc_level: number | null;
  license_status: string | null;
  insurance_status: string | null;
  decided_at: string | null;
  decided_by: string | null;
  deactivated_at: string | null;
  profiles: ProfileRow | null;
}

/**
 * Obtiene la lista de repartidores postulantes filtrados por estado.
 * Se asegura de que no se expongan datos bancarios ni PII no autorizada.
 */
export async function getApplicantsQueue(
  tab: AdminApplicantTab = 'pending'
): Promise<ApplicantListItem[]> {
  const supabase = createAdminClient();

  const { data: couriers, error } = await supabase
    .from('couriers')
    .select(`
      profile_id,
      status,
      vehicle_type,
      vehicle_plate,
      dni_hmac,
      doc_level,
      license_status,
      insurance_status,
      profiles:profile_id (
        display_name,
        phone,
        created_at
      ),
      courier_documents (
        kind,
        status
      )
    `)
    .eq('status', tab)
    .order('profile_id', { ascending: false });

  if (error || !couriers) {
    return [];
  }

  const typedCouriers = couriers as unknown as CourierQueueRow[];

  return typedCouriers.map((c) => {
    const profile = c.profiles;
    const docs = c.courier_documents ?? [];

    const hasDniFront = docs.some((d) => d.kind === 'dni_front');
    const hasDniBack = docs.some((d) => d.kind === 'dni_back');
    const hasSelfie = docs.some((d) => d.kind === 'selfie');
    const hasLicense = docs.some((d) => d.kind === 'license');
    const hasInsurance = docs.some((d) => d.kind === 'insurance');

    return {
      id: c.profile_id,
      fullName: profile?.display_name ?? 'Repartidor',
      dniHash: c.dni_hmac ? `${c.dni_hmac.slice(0, 8)}...` : 'Pendiente',
      phone: profile?.phone ?? '',
      vehicleType: (c.vehicle_type as 'walk' | 'bike' | 'moto' | 'car') ?? 'bike',
      status: c.status as AdminApplicantTab,
      docLevel: (c.doc_level ?? 0) as CourierDocLevel,
      createdAt: profile?.created_at ?? new Date().toISOString(),
      licenseStatus: (c.license_status as 'none' | 'submitted' | 'verified' | 'rejected') ?? 'none',
      insuranceStatus: (c.insurance_status as 'none' | 'submitted' | 'verified' | 'rejected') ?? 'none',
      documentsSummary: {
        hasDniFront,
        hasDniBack,
        hasSelfie,
        hasLicense,
        hasInsurance,
      },
    };
  });
}

/**
 * Obtiene el detalle completo del postulante para el visor documental A02.
 * INVARIANTE: CBU / Alias bancario queda terminantemente extirpado de la respuesta.
 */
export async function getApplicantDetail(
  courierId: string
): Promise<ApplicantDetail | null> {
  const supabase = createAdminClient();

  const [courierResult, docsResult] = await Promise.all([
    supabase
      .from('couriers')
      .select(`
        profile_id,
        status,
        vehicle_type,
        vehicle_plate,
        dni_hmac,
        doc_level,
        license_status,
        insurance_status,
        decided_at,
        decided_by,
        deactivated_at,
        profiles:profile_id (
          display_name,
          phone,
          created_at
        )
      `)
      .eq('profile_id', courierId)
      .maybeSingle(),
    supabase
      .from('courier_documents')
      .select('id, kind, storage_path, status, uploaded_at')
      .eq('courier_id', courierId)
      .order('uploaded_at', { ascending: true }),
  ]);

  if (courierResult.error || !courierResult.data) {
    return null;
  }

  const c = courierResult.data as unknown as CourierDetailRow;
  const profile = c.profiles;

  const documents: ApplicantDocumentDetail[] = (docsResult.data ?? []).map((d) => ({
    id: d.id,
    documentType: d.kind,
    storagePath: d.storage_path,
    status: d.status,
    uploadedAt: d.uploaded_at,
  }));

  return {
    id: c.profile_id,
    fullName: profile?.display_name ?? 'Repartidor',
    dniHash: c.dni_hmac ? `${c.dni_hmac.slice(0, 12)}...` : 'Pendiente',
    phone: profile?.phone ?? '',
    vehicleType: (c.vehicle_type as 'walk' | 'bike' | 'moto' | 'car') ?? 'bike',
    vehiclePlate: c.vehicle_plate,
    status: c.status as AdminApplicantTab,
    docLevel: (c.doc_level ?? 0) as CourierDocLevel,
    licenseStatus: (c.license_status as 'none' | 'submitted' | 'verified' | 'rejected') ?? 'none',
    insuranceStatus: (c.insurance_status as 'none' | 'submitted' | 'verified' | 'rejected') ?? 'none',
    decidedAt: c.decided_at,
    decidedBy: c.decided_by,
    deactivatedAt: c.deactivated_at,
    createdAt: profile?.created_at ?? new Date().toISOString(),
    documents,
  };
}
