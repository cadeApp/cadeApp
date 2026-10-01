import 'server-only';

import {
  PLATFORM_SETTING_KEYS,
  merchantSubscriptionStatusSchema,
  type PlatformSettingKey,
} from '@/domain';
import { createClient } from '@/server/supabase/server';
import { ADMIN_COPY } from './copy';
import { updatePlatformSettingSchema, type AdminAuditFilters } from './schemas';
import type {
  AdminApplicantTab,
  AdminMerchantListItem,
  AdminMerchantsResult,
  AuditActorOption,
  AuditChange,
  AuditChangeValue,
  AuditLogItem,
  AuditLogResult,
  PlatformSettingsSnapshot,
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
      profiles!couriers_profile_id_fkey (
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
        profiles!couriers_profile_id_fkey (
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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const RECENT_SETTING_CHANGES_LIMIT = 5;
const AUDIT_ACTORS_LIMIT = 50;

function clampPageSize(pageSize: number | undefined): number {
  return Math.min(Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE);
}

export interface GetAdminMerchantsOptions {
  readonly cursor?: string;
  readonly pageSize?: number;
}

interface MerchantRow {
  profile_id: string;
  business_name: string;
  subscription_status: string;
  paid_until: string | null;
  profiles: { display_name: string | null; phone: string | null } | null;
  zones: { name: string } | null;
  delivery_requests: { count: number }[] | null;
}

/**
 * A03: comercios paginados por cursor; se identifican por nombre del local y teléfono.
 * Cuenta solo solicitudes entregadas. Usa el cliente de sesión (RLS del admin).
 */
export async function getAdminMerchants(
  options?: GetAdminMerchantsOptions
): Promise<AdminMerchantsResult> {
  const pageSize = clampPageSize(options?.pageSize);
  const supabase = await createClient();

  let query = supabase
    .from('merchants')
    .select(
      `
      profile_id,
      business_name,
      subscription_status,
      paid_until,
      profiles!merchants_profile_id_fkey ( display_name, phone ),
      zones:default_pickup_zone_id ( name ),
      delivery_requests ( count )
    `
    )
    .eq('delivery_requests.status', 'delivered')
    .order('profile_id', { ascending: false });

  if (options?.cursor) {
    query = query.lt('profile_id', options.cursor);
  }

  const { data, error } = await query.limit(pageSize + 1);

  if (error) {
    throw new Error(`Error al consultar los comercios: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as MerchantRow[];
  const hasNextPage = rows.length > pageSize;
  const visibleRows = rows.slice(0, pageSize);

  const items: AdminMerchantListItem[] = visibleRows.map((row) => ({
    id: row.profile_id,
    businessName: row.business_name,
    ownerName: row.profiles?.display_name ?? '',
    phone: row.profiles?.phone ?? '',
    pickupZoneName: row.zones?.name ?? null,
    subscriptionStatus: merchantSubscriptionStatusSchema.parse(row.subscription_status),
    paidUntil: row.paid_until,
    deliveredCount: row.delivery_requests?.[0]?.count ?? 0,
  }));

  return {
    items,
    pageSize,
    nextCursor: hasNextPage ? visibleRows[visibleRows.length - 1]?.profile_id ?? null : null,
    hasNextPage,
  };
}

/**
 * A04: valores vigentes de `platform_settings`, validados con el contrato de `admin_update_setting`.
 * Nunca usa valores por defecto: si falta una clave o su tipo es inválido, falla.
 */
export async function getPlatformSettings(): Promise<PlatformSettingsSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', [...PLATFORM_SETTING_KEYS]);

  if (error) {
    throw new Error(`Error al consultar los parámetros: ${error.message}`);
  }

  const values = new Map<PlatformSettingKey, unknown>();
  for (const row of (data ?? []) as unknown as { key: string; value: unknown }[]) {
    const setting = updatePlatformSettingSchema.parse({ key: row.key, value: row.value });
    values.set(setting.key, setting.value);
  }

  function read<T>(key: PlatformSettingKey, guard: (value: unknown) => value is T): T {
    const value = values.get(key);
    if (!guard(value)) {
      throw new Error(`Parámetro de plataforma ausente o inválido: ${key}`);
    }
    return value;
  }

  const isNumber = (value: unknown): value is number => typeof value === 'number';
  const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
  const isString = (value: unknown): value is string => typeof value === 'string';

  return {
    minOfferArs: read('min_offer_ars', isNumber),
    requestTtlMinutes: read('request_ttl_minutes', isNumber),
    pilotActive: read('pilot_active', isBoolean),
    pilotTermsVersion: read('pilot_terms_version', isString),
    subscriptionGraceDays: read('subscription_grace_days', isNumber),
  };
}

export interface GetAuditLogOptions extends AdminAuditFilters {
  readonly pageSize?: number;
}

interface AuditRow {
  id: number;
  created_at: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  before: unknown;
  after: unknown;
  profiles: { display_name: string | null } | null;
}

const AUDIT_SELECT = `
  id,
  created_at,
  actor_id,
  action,
  target_type,
  target_id,
  before,
  after,
  profiles!audit_log_actor_id_fkey ( display_name )
`;

/**
 * Campos operativos que se pueden mostrar. Todo lo demás de `before`/`after` (motivos, notas y
 * cualquier texto libre que pueda traer datos personales) se descarta.
 */
const AUDIT_CHANGE_FIELDS = [
  'status',
  'subscription_status',
  'paid_until',
  'value',
  'kind',
  'docLevel',
  'withdrawnOffersCount',
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asChangeValue(value: unknown): AuditChangeValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : null;
}

function toAuditLogItem(row: AuditRow): AuditLogItem {
  const before = asRecord(row.before);
  const after = asRecord(row.after);

  const changes: AuditChange[] = AUDIT_CHANGE_FIELDS.filter(
    (field) => field in before || field in after
  ).map((field) => ({
    field,
    before: asChangeValue(before[field]),
    after: asChangeValue(after[field]),
  }));

  const reason = after.reason;

  return {
    id: row.id,
    createdAt: row.created_at,
    actorName:
      row.actor_id === null
        ? null
        : row.profiles?.display_name?.trim() || ADMIN_COPY.audit.unnamedOperator,
    action: row.action,
    targetType: row.target_type,
    targetRef: row.target_type === 'platform_setting' ? row.target_id : row.target_id.slice(0, 8),
    changes,
    hasReason: typeof reason === 'string' && reason.trim().length > 0,
  };
}

/**
 * A06: lectura de `audit_log` paginada server-side por cursor de `id`, con filtros en la base y
 * detalle saneado. Usa el cliente de sesión (RLS del admin); la feature nunca escribe esta tabla.
 */
export async function getAuditLog(options?: GetAuditLogOptions): Promise<AuditLogResult> {
  const pageSize = clampPageSize(options?.pageSize);
  const supabase = await createClient();

  let query = supabase.from('audit_log').select(AUDIT_SELECT).order('id', { ascending: false });

  if (options?.cursor !== undefined) {
    query = query.lt('id', options.cursor);
  }
  if (options?.actorId) {
    query = query.eq('actor_id', options.actorId);
  }
  if (options?.action) {
    query = query.eq('action', options.action);
  }
  if (options?.targetType) {
    query = query.eq('target_type', options.targetType);
  }

  const { data, error } = await query.limit(pageSize + 1);

  if (error) {
    throw new Error(`Error al consultar la auditoría: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as AuditRow[];
  const hasNextPage = rows.length > pageSize;
  const visibleRows = rows.slice(0, pageSize);

  return {
    items: visibleRows.map(toAuditLogItem),
    pageSize,
    nextCursor: hasNextPage ? visibleRows[visibleRows.length - 1]?.id ?? null : null,
    hasNextPage,
  };
}

/**
 * A04: últimos cambios de parámetros para el panel lateral (máximo 5, mismo saneamiento que A06).
 */
export async function getRecentSettingChanges(
  limit: number = RECENT_SETTING_CHANGES_LIMIT
): Promise<readonly AuditLogItem[]> {
  const boundedLimit = Math.min(Math.max(1, Math.floor(limit)), RECENT_SETTING_CHANGES_LIMIT);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('audit_log')
    .select(AUDIT_SELECT)
    .eq('target_type', 'platform_setting')
    .order('id', { ascending: false })
    .limit(boundedLimit);

  if (error) {
    throw new Error(`Error al consultar los últimos cambios: ${error.message}`);
  }

  return ((data ?? []) as unknown as AuditRow[]).map(toAuditLogItem);
}

/**
 * A06: operadores (admins) para el filtro de auditoría; solo id y nombre.
 */
export async function getAuditActors(): Promise<readonly AuditActorOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('role', 'admin')
    .order('display_name', { ascending: true })
    .limit(AUDIT_ACTORS_LIMIT);

  if (error) {
    throw new Error(`Error al consultar los operadores: ${error.message}`);
  }

  return ((data ?? []) as unknown as { id: string; display_name: string | null }[]).map(
    (row) => ({
      id: row.id,
      name: row.display_name?.trim() || ADMIN_COPY.audit.unnamedOperator,
    })
  );
}
