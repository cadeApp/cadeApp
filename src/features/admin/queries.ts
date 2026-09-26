import 'server-only';

import { createClient } from '@/server/supabase/server';
import type {
  AdminApplicantTab,
  ApplicantDetail,
  ApplicantDocumentDetail,
  ApplicantListItem,
  CourierDocLevel,
} from './types';

export interface GetApplicantsQueueOptions {
  readonly cursor?: string;
  readonly pageSize?: number;
}

export interface ApplicantsQueueResult {
  readonly items: readonly ApplicantListItem[];
  readonly pageSize: number;
  readonly nextCursor: string | null;
  readonly hasNextPage: boolean;
}

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
 * PR106-H07: Paginación por cursor estable por profile_id con máximo 50 por página (por defecto 20).
 * PR106-H08: Propagación de fallos de DB a través de excepciones hacia error boundaries.
 * PR106-H12: Utiliza el cliente de sesión autenticada con RLS (createClient), no service_role.
 */
export async function getApplicantsQueue(
  tab: AdminApplicantTab = 'pending',
  options?: GetApplicantsQueueOptions
): Promise<ApplicantsQueueResult> {
  const pageSize = Math.min(Math.max(1, Math.floor(options?.pageSize ?? 20)), 50);

  const supabase = await createClient();

  let query = supabase
    .from('couriers')
    .select(
      `
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
    `
    )
    .eq('status', tab)
    .order('profile_id', { ascending: false });

  if (options?.cursor) {
    query = query.lt('profile_id', options.cursor);
  }

  query = query.limit(pageSize + 1);

  const { data: couriers, error } = await query;

  if (error) {
    throw new Error(`Error al consultar la cola de postulantes: ${error.message}`);
  }

  const typedCouriers = (couriers ?? []) as unknown as CourierQueueRow[];
  const hasNextPage = typedCouriers.length > pageSize;
  const visibleRows = typedCouriers.slice(0, pageSize);
  const nextCursor =
    hasNextPage && visibleRows.length > 0
      ? visibleRows[visibleRows.length - 1]?.profile_id ?? null
      : null;

  const items: ApplicantListItem[] = visibleRows.map((c) => {
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

  return {
    items,
    pageSize,
    nextCursor,
    hasNextPage,
  };
}

/**
 * Obtiene el detalle completo del postulante para el visor documental A02.
 * INVARIANTE: CBU / Alias bancario queda terminantemente extirpado de la respuesta.
 * PR106-H08: Propagación de fallos de DB a través de excepciones hacia error boundaries.
 * PR106-H12: Utiliza el cliente de sesión autenticada con RLS (createClient), no service_role.
 */
export async function getApplicantDetail(
  courierId: string
): Promise<ApplicantDetail | null> {
  const supabase = await createClient();

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

  if (courierResult.error) {
    throw new Error(`Error al consultar el postulante: ${courierResult.error.message}`);
  }

  if (docsResult.error) {
    throw new Error(`Error al consultar los documentos del postulante: ${docsResult.error.message}`);
  }

  if (!courierResult.data) {
    return null;
  }

  const c = courierResult.data as unknown as CourierDetailRow;
  const profile = c.profiles;

  interface CourierDocDetailRow {
    id: string;
    kind: 'dni_front' | 'dni_back' | 'selfie' | 'avatar' | 'license' | 'insurance';
    storage_path: string;
    status: 'none' | 'submitted' | 'verified' | 'rejected';
    uploaded_at: string;
  }

  const rawDocs = (docsResult.data ?? []) as unknown as CourierDocDetailRow[];
  const documents: ApplicantDocumentDetail[] = rawDocs.map((d) => ({
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
