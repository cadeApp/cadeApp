import 'server-only';

import { z } from 'zod';
import {
  PLATFORM_SETTING_KEYS,
  err,
  merchantSubscriptionStatusSchema,
  ok,
  type ActionResult,
  type DomainErrorCode,
  type PlatformSettingKey,
  type RpcOutput,
} from '@/domain';
import {
  adminGetMerchantPublicationCreditsRpc,
  adminListPublicationPlansRpc,
  type SupabaseRpcCaller,
} from '@/server/rpc/admin';
import { adminListApplicantsRpc } from '@/server/rpc/admin-applicants';
import { createClient } from '@/server/supabase/server';
import { ADMIN_COPY } from './copy';
import { auditActionLabel } from './audit-format';
import { auditDateRangeBounds, updatePlatformSettingSchema, type AdminAuditFilters } from './schemas';
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
  PublicationPlansPage,
  PublicationPlansQuery,
  AdminMerchantHeader,
  ApplicantConsent,
  ApplicantDetail,
  ApplicantDocumentDetail,
  ApplicantHistoryEvent,
  ApplicantQueueItem,
  CourierDocLevel,
} from './types';

export interface GetApplicantsQueueOptions {
  /** Cursor «fecha~id» ya validado (`adminApplicantsCursorSchema`). */
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  /** Término de búsqueda por nombre; la RPC lo normaliza (sin tildes ni mayúsculas). */
  readonly query?: string;
  readonly pageSize?: number;
}

export interface ApplicantsQueueResult {
  readonly items: readonly ApplicantQueueItem[];
  readonly pageSize: number;
  /** Cantidad exacta del estado con la búsqueda aplicada (en «pending», solo postulaciones enviadas). */
  readonly total: number;
  readonly nextCursor: string | null;
  readonly prevCursor: string | null;
  readonly hasNextPage: boolean;
  readonly hasPrevPage: boolean;
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
  submitted_at: string | null;
  profiles: ProfileRow | null;
}

/**
 * Obtiene la lista de repartidores postulantes filtrados por estado.
 * Se asegura de que no se expongan datos bancarios ni PII no autorizada.
 * PR106-H07: Paginación por cursor estable con máximo 50 por página (por defecto 20); T-420: por fecha de registro.
 * PR106-H08: Propagación de fallos de DB a través de excepciones hacia error boundaries.
 * PR106-H12: Utiliza el cliente de sesión autenticada con RLS (createClient), no service_role.
 */
export async function getApplicantsQueue(
  tab: AdminApplicantTab = 'pending',
  options?: GetApplicantsQueueOptions
): Promise<ApplicantsQueueResult> {
  const pageSize = Math.min(Math.max(1, Math.floor(options?.pageSize ?? 20)), 50);
  const supabase = await createClient();

  // T-403 / CC-044: estado, búsqueda sin tildes, total y keyset en los dos sentidos se resuelven en PostgreSQL; la
  // RPC exige admin con aal2. El cursor de la URL es «fecha~id» (T-420).
  const [cursorCreatedAt, cursorId] = options?.cursor ? options.cursor.split('~') : [];
  const result = await adminListApplicantsRpc(supabase, {
    status: tab,
    query: options?.query || undefined,
    cursor: cursorCreatedAt && cursorId ? { createdAt: cursorCreatedAt, id: cursorId } : null,
    direction: options?.direction ?? 'next',
    limit: pageSize,
  });

  if (!result.ok) {
    throw new Error(`Error al consultar la cola de postulantes: ${result.code}`);
  }

  const { items, total, nextCursor, prevCursor } = result.data;
  return {
    items: items.map((row) => ({
      id: row.id,
      fullName: row.displayName || 'Repartidor',
      hasDni: row.hasDni,
      phone: row.phone ?? '',
      vehicleType: row.vehicleType,
      status: row.status,
      docLevel: row.docLevel as CourierDocLevel,
      createdAt: row.createdAt,
      submittedAt: row.submittedAt,
      licenseStatus: row.licenseStatus,
      insuranceStatus: row.insuranceStatus,
      documentsSummary: {
        hasDniFront: row.documents.dniFront,
        hasDniBack: row.documents.dniBack,
        hasSelfie: row.documents.selfie,
        hasLicense: row.documents.license,
        hasInsurance: row.documents.insurance,
      },
    })),
    pageSize,
    total,
    nextCursor: nextCursor ? serializeRegisteredCursor(nextCursor.createdAt, nextCursor.id) : null,
    prevCursor: prevCursor ? serializeRegisteredCursor(prevCursor.createdAt, prevCursor.id) : null,
    hasNextPage: nextCursor !== null,
    hasPrevPage: prevCursor !== null,
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

  const [courierResult, docsResult, consentsResult] = await Promise.all([
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
        submitted_at,
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
      .select(
        'id, kind, storage_path, status, uploaded_at, is_current, rejection_code, vehicle:courier_vehicles!courier_documents_vehicle_id_fkey(vehicle_type, plate)'
      )
      .eq('courier_id', courierId)
      .order('uploaded_at', { ascending: true }),
    supabase
      .from('consents')
      .select('document, version, accepted_at')
      .eq('profile_id', courierId)
      .order('accepted_at', { ascending: true }),
  ]);

  if (courierResult.error) {
    throw new Error(`Error al consultar el postulante: ${courierResult.error.message}`);
  }

  if (docsResult.error) {
    throw new Error(`Error al consultar los documentos del postulante: ${docsResult.error.message}`);
  }

  if (consentsResult.error) {
    throw new Error(`Error al consultar los consentimientos del postulante: ${consentsResult.error.message}`);
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
    is_current?: boolean | null;
    rejection_code?: string | null;
    vehicle?: { vehicle_type: 'walk' | 'bike' | 'moto' | 'car'; plate: string | null } | null;
  }

  const rawDocs = (docsResult.data ?? []) as unknown as CourierDocDetailRow[];
  // CC-042: clave para agrupar licencia y seguro por vehículo (los documentos sin vehículo conservan su orden).
  const vehicleKey = (d: CourierDocDetailRow) => (d.vehicle ? `${d.vehicle.vehicle_type}:${d.vehicle.plate ?? ''}` : '');
  // Los documentos vigentes (is_current !== false) van primero; los históricos van al final
  const sortedDocs = [...rawDocs].sort((a, b) => {
    const aCurrent = a.is_current !== false ? 1 : 0;
    const bCurrent = b.is_current !== false ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    const byVehicle = vehicleKey(a).localeCompare(vehicleKey(b));
    if (byVehicle !== 0) return byVehicle;
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
  });

  const documents: ApplicantDocumentDetail[] = sortedDocs.map((d) => ({
    id: d.id,
    documentType: d.kind,
    storagePath: d.storage_path,
    status: d.status,
    uploadedAt: d.uploaded_at,
    isCurrent: d.is_current !== false,
    rejectionCode: d.rejection_code ?? null,
    vehicle: d.vehicle ? { vehicleType: d.vehicle.vehicle_type, plate: d.vehicle.plate } : null,
  }));

  const auditRows = await getApplicantAuditRows(supabase, courierId, rawDocs.map((d) => d.id));
  const docKinds = new Map(rawDocs.map((d) => [d.id, d.kind]));
  const consents: ApplicantConsent[] = (
    (consentsResult.data ?? []) as unknown as { document: ApplicantConsent['document']; version: string; accepted_at: string }[]
  ).map((consent) => ({ document: consent.document, version: consent.version, acceptedAt: consent.accepted_at }));
  const history = buildApplicantHistory({
    registeredAt: profile?.created_at ?? null,
    submittedAt: c.submitted_at,
    auditRows,
    docKinds,
  });

  return {
    id: c.profile_id,
    fullName: profile?.display_name ?? 'Repartidor',
    hasDni: Boolean(c.dni_hmac),
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
    submittedAt: c.submitted_at,
    documents,
    consents,
    history,
  };
}

const APPLICANT_HISTORY_LIMIT = 50;

/**
 * T-404: filtro PostgREST de los eventos de un repartidor (`target_type = 'courier'`) y de sus documentos (por id o
 * por `courier_id` en `before`/`after`). Lo comparten el historial del detalle y «Ver todo en Auditoría».
 */
function applicantAuditFilter(courierId: string, documentIds: readonly string[]): string {
  const documentFilters = [
    `after->>courier_id.eq.${courierId}`,
    `before->>courier_id.eq.${courierId}`,
    ...(documentIds.length > 0 ? [`target_id.in.(${documentIds.join(',')})`] : []),
  ].join(',');
  return `and(target_type.eq.courier,target_id.eq.${courierId}),and(target_type.eq.courier_document,or(${documentFilters}))`;
}

/**
 * T-404: filas de `audit_log` del repartidor (`target_type = 'courier'`) y de sus documentos (por id o por
 * `courier_id` en `before`/`after`), las más nuevas primero. Una de más indica que el historial está recortado.
 */
async function getApplicantAuditRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courierId: string,
  documentIds: readonly string[]
): Promise<AuditRow[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select(AUDIT_SELECT)
    .or(applicantAuditFilter(courierId, documentIds))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(APPLICANT_HISTORY_LIMIT);

  if (error) {
    throw new Error(`Error al consultar el historial del postulante: ${error.message}`);
  }
  return (data ?? []) as unknown as AuditRow[];
}

/**
 * T-404: historial solo con eventos reales, del más viejo al más nuevo. «Registrado» es `profiles.created_at`,
 * «Postulación enviada» es `couriers.submitted_at` (CC-043) y solo aparece si no es `null`; el resto son filas
 * de `audit_log` con las etiquetas y los motivos de T-400. No se inventa ningún evento que la base no registre.
 * PR607-D03 = C: las 50 auditorías más nuevas más los dos hitos (máximo 52); los hitos nunca se recortan.
 */
function buildApplicantHistory(input: {
  readonly registeredAt: string | null;
  readonly submittedAt: string | null;
  readonly auditRows: readonly AuditRow[];
  readonly docKinds: ReadonlyMap<string, string>;
}): ApplicantHistoryEvent[] {
  const events: ApplicantHistoryEvent[] = [];
  if (input.registeredAt) events.push({ kind: 'registered', id: 'registered', at: input.registeredAt });
  if (input.submittedAt) events.push({ kind: 'submitted', id: 'submitted', at: input.submittedAt });

  for (const row of input.auditRows) {
    const item = toAuditLogItem(row, new Map());
    const before = asRecord(row.before);
    const after = asRecord(row.after);
    events.push({
      kind: 'audit',
      id: `audit-${row.id}`,
      at: row.created_at,
      label: auditActionLabel(row.action),
      detail:
        row.target_type === 'courier_document'
          ? documentKindLabel(after.kind ?? before.kind ?? input.docKinds.get(row.target_id))
          : null,
      reason: item.reason,
      actorName: item.actorName,
    });
  }

  // Empates deterministas: los hitos antes que la auditoría y, entre auditorías, por id.
  const tieRank = (event: ApplicantHistoryEvent) =>
    event.kind === 'registered' ? -2 : event.kind === 'submitted' ? -1 : Number(event.id.slice('audit-'.length));
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || tieRank(a) - tieRank(b));
  return events;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const RECENT_SETTING_CHANGES_LIMIT = 5;
const AUDIT_ACTORS_LIMIT = 50;

/**
 * T-420: las listas del admin van de la más nueva a la más vieja por fecha de registro (`profiles.created_at`), con
 * `profile_id` para desempatar. El cursor es «fecha~id» (validado con `adminRegisteredCursorSchema`) y se aplica sobre
 * el perfil embebido con `!inner`, así que filtra las filas de la tabla principal.
 */
function serializeRegisteredCursor(createdAt: string, id: string): string {
  return `${createdAt}~${id}`;
}

function registeredCursorFilter(cursor: string): string {
  const [createdAt, id] = cursor.split('~');
  return `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id})`;
}

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
  profiles: ProfileRow | null;
  zones: { name: string } | null;
}

// Issue 336: salida de `admin_merchant_delivered_counts`. Solo id del comercio y cantidad de solicitudes entregadas.
const merchantDeliveredCountsSchema = z.array(
  z
    .object({
      merchant_id: z.string().guid(),
      delivered_count: z.number().int().nonnegative(),
    })
    .strict()
);

/**
 * A03: comercios paginados por cursor; se identifican por nombre del local y teléfono.
 * Cuenta solo solicitudes entregadas. Usa el cliente de sesión (RLS del admin).
 * CC-023 cerró el SELECT de tabla de `delivery_requests`, así que el conteo no se embebe: sale de una única
 * llamada a la RPC admin `admin_merchant_delivered_counts` con los comercios de la página visible (issue 336).
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
      profiles!merchants_profile_id_fkey!inner ( display_name, phone, created_at ),
      zones:default_pickup_zone_id ( name )
    `
    )
    .order('profiles(created_at)', { ascending: false })
    .order('profile_id', { ascending: false });

  if (options?.cursor) {
    query = query.or(registeredCursorFilter(options.cursor), { referencedTable: 'profiles' });
  }

  const { data, error } = await query.limit(pageSize + 1);

  if (error) {
    throw new Error(`Error al consultar los comercios: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as MerchantRow[];
  const hasNextPage = rows.length > pageSize;
  const visibleRows = rows.slice(0, pageSize);

  const deliveredCounts = new Map<string, number>();
  if (visibleRows.length > 0) {
    // Mismo cliente de sesión, tipado como en las demás RPC (`SupabaseRpcCaller`).
    const rpcClient: SupabaseRpcCaller = supabase;
    const { data: countsData, error: countsError } = await rpcClient.rpc(
      'admin_merchant_delivered_counts',
      { p_merchant_ids: visibleRows.map((row) => row.profile_id) }
    );

    if (countsError) {
      throw new Error(`Error al contar las solicitudes entregadas: ${countsError.message}`);
    }

    for (const count of merchantDeliveredCountsSchema.parse(countsData)) {
      deliveredCounts.set(count.merchant_id, count.delivered_count);
    }
  }

  const items: AdminMerchantListItem[] = visibleRows.map((row) => ({
    id: row.profile_id,
    businessName: merchantDisplayName(row.business_name),
    signupIncomplete: !row.business_name.trim(),
    ownerName: row.profiles?.display_name ?? '',
    phone: row.profiles?.phone ?? '',
    pickupZoneName: row.zones?.name ?? null,
    subscriptionStatus: merchantSubscriptionStatusSchema.parse(row.subscription_status),
    paidUntil: row.paid_until,
    deliveredCount: deliveredCounts.get(row.profile_id) ?? 0,
    createdAt: row.profiles?.created_at ?? null,
  }));

  const lastRow = visibleRows[visibleRows.length - 1];
  return {
    items,
    pageSize,
    nextCursor:
      hasNextPage && lastRow?.profiles ? serializeRegisteredCursor(lastRow.profiles.created_at, lastRow.profile_id) : null,
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
    maxDropsPerRequest: read('max_drops_per_request', isNumber),
    // CC-041: la migración lo carga en 10; antes de aplicarla se muestra el mismo valor que usa la RPC por defecto.
    courierOnlineWindowMinutes: values.has('courier_online_window_minutes')
      ? read('courier_online_window_minutes', isNumber)
      : 10,
    publicationDropsPerCredit: read('publication_drops_per_credit', isNumber),
    carryoverBasePct: read('carryover_base_pct', isNumber),
    carryoverStepPct: read('carryover_step_pct', isNumber),
    carryoverCapPct: read('carryover_cap_pct', isNumber),
    launchDiscountPct: read('launch_discount_pct', isNumber),
    // CC-029: la migración no le da valor; queda vacío hasta que el admin lo cargue.
    looseCreditReferencePriceArs: values.has('loose_credit_reference_price_ars')
      ? read('loose_credit_reference_price_ars', isNumber)
      : null,
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

/**
 * T-400 (decisión de Lautaro073, 2026-10-21): solo estos motivos los escribe un admin para otro admin.
 * El texto libre de cualquier otra acción puede traer datos personales y se sigue descartando.
 */
const AUDIT_REASON_ACTIONS: ReadonlySet<string> = new Set([
  'admin_decide_courier',
  'admin_suspend_courier',
  'admin_reinstate_courier',
  'admin_verify_document',
]);

const auditUuidSchema = z.string().guid();

/** Nombres del afectado por `audit_log.id`; las filas sin nombre resuelto no figuran. */
type AuditTargetNames = ReadonlyMap<number, string>;

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** PR582-H01: el motivo se muestra tal como quedó registrado; solo se descarta si está vacío. */
function asAuditReason(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function documentKindLabel(kind: unknown): string | null {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(ADMIN_COPY.documentKind, kind)
    ? ADMIN_COPY.documentKind[kind as keyof typeof ADMIN_COPY.documentKind]
    : null;
}

/**
 * T-400: resuelve en lote, con la sesión del admin (RLS), a quién afectó cada fila de la página: una consulta
 * por tabla, nunca una por fila, y siempre con el `target_id` completo. Los nombres son un agregado de lectura:
 * si una consulta falla o la fila ya no existe, esa entidad queda con su id corto.
 */
async function resolveAuditTargetNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: readonly AuditRow[]
): Promise<AuditTargetNames> {
  const isUuid = (value: unknown): value is string => auditUuidSchema.safeParse(value).success;
  const courierIds = new Set<string>();
  const merchantIds = new Set<string>();
  const unknownOwnerDocIds = new Set<string>();

  for (const row of rows) {
    if (!isUuid(row.target_id)) continue;
    if (row.target_type === 'courier') courierIds.add(row.target_id);
    if (row.target_type === 'merchant') merchantIds.add(row.target_id);
    if (row.target_type === 'courier_document') {
      const owner = asRecord(row.after).courier_id ?? asRecord(row.before).courier_id;
      if (isUuid(owner)) courierIds.add(owner);
      else unknownOwnerDocIds.add(row.target_id);
    }
  }

  const [docsResult, merchantsResult] = await Promise.all([
    unknownOwnerDocIds.size > 0
      ? supabase.from('courier_documents').select('id, courier_id, kind').in('id', [...unknownOwnerDocIds])
      : null,
    merchantIds.size > 0
      ? supabase
          .from('merchants')
          .select('profile_id, business_name, profiles!merchants_profile_id_fkey ( display_name )')
          .in('profile_id', [...merchantIds])
      : null,
  ]);

  const docs = new Map<string, { courierId: string; kind: unknown }>();
  if (docsResult && !docsResult.error) {
    for (const doc of (docsResult.data ?? []) as unknown as { id: string; courier_id: string; kind: string }[]) {
      docs.set(doc.id, { courierId: doc.courier_id, kind: doc.kind });
      courierIds.add(doc.courier_id);
    }
  }

  const merchantNames = new Map<string, string>();
  if (merchantsResult && !merchantsResult.error) {
    for (const merchant of (merchantsResult.data ?? []) as unknown as {
      profile_id: string;
      business_name: string | null;
      profiles: { display_name: string | null } | null;
    }[]) {
      const name = asText(merchant.business_name) ?? asText(merchant.profiles?.display_name);
      if (name) merchantNames.set(merchant.profile_id, name);
    }
  }

  const courierNames = new Map<string, string>();
  if (courierIds.size > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', [...courierIds]);
    if (!error) {
      for (const profile of (data ?? []) as unknown as { id: string; display_name: string | null }[]) {
        const name = asText(profile.display_name);
        if (name) courierNames.set(profile.id, name);
      }
    }
  }

  const names = new Map<number, string>();
  for (const row of rows) {
    let name: string | null = null;
    if (row.target_type === 'courier') name = courierNames.get(row.target_id) ?? null;
    if (row.target_type === 'merchant') name = merchantNames.get(row.target_id) ?? null;
    // Mismo código corto que usa la app para las solicitudes (admin-trips).
    if (row.target_type === 'delivery_request') name = `REQ-${row.target_id.slice(0, 8).toUpperCase()}`;
    if (row.target_type === 'courier_document') {
      const before = asRecord(row.before);
      const after = asRecord(row.after);
      const doc = docs.get(row.target_id);
      const owner = after.courier_id ?? before.courier_id ?? doc?.courierId;
      const ownerName = typeof owner === 'string' ? courierNames.get(owner) : undefined;
      const kind = documentKindLabel(after.kind ?? before.kind ?? doc?.kind);
      name = ownerName ? (kind ? `${ownerName} · ${kind}` : ownerName) : null;
    }
    if (name) names.set(row.id, name);
  }
  return names;
}

function toAuditLogItem(row: AuditRow, names: AuditTargetNames): AuditLogItem {
  const before = asRecord(row.before);
  const after = asRecord(row.after);

  const changes: AuditChange[] = AUDIT_CHANGE_FIELDS.filter(
    (field) => field in before || field in after
  ).map((field) => ({
    field,
    ...(field in before ? { before: asChangeValue(before[field]) } : {}),
    ...(field in after ? { after: asChangeValue(after[field]) } : {}),
  }));

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
    targetName: names.get(row.id) ?? null,
    changes,
    reason: AUDIT_REASON_ACTIONS.has(row.action) ? asAuditReason(after.reason) : null,
  };
}

/**
 * A06: lectura de `audit_log` paginada server-side por cursor de `id`, con filtros en la base y
 * detalle saneado. Usa el cliente de sesión (RLS del admin); la feature nunca escribe esta tabla.
 */
export async function getAuditLog(options?: GetAuditLogOptions): Promise<AuditLogResult> {
  const pageSize = clampPageSize(options?.pageSize);
  const supabase = await createClient();
  const cursor = options?.cursor;
  const prev = cursor !== undefined && options?.direction === 'prev';

  let courierFilter: string | undefined;
  if (options?.courierId) {
    const { data: docs, error: docsError } = await supabase
      .from('courier_documents')
      .select('id')
      .eq('courier_id', options.courierId);
    if (docsError) {
      throw new Error(`Error al consultar los documentos del repartidor: ${docsError.message}`);
    }
    courierFilter = applicantAuditFilter(
      options.courierId,
      ((docs ?? []) as unknown as { id: string }[]).map((doc) => doc.id)
    );
  }

  // T-407: la página y el sondeo del otro sentido comparten exactamente los mismos filtros.
  const filtered = (columns: string) => {
    let query = supabase.from('audit_log').select(columns);
    if (options?.actorId) query = query.eq('actor_id', options.actorId);
    if (options?.action) query = query.eq('action', options.action);
    if (options?.targetType) query = query.eq('target_type', options.targetType);
    if (options?.targetId) query = query.eq('target_id', options.targetId);
    const { gte, lt } = auditDateRangeBounds(options ?? {});
    if (gte) query = query.gte('created_at', gte);
    if (lt) query = query.lt('created_at', lt);
    if (courierFilter) query = query.or(courierFilter);
    return query;
  };

  let pageQuery = filtered(AUDIT_SELECT).order('id', { ascending: prev });
  if (cursor !== undefined) pageQuery = prev ? pageQuery.gt('id', cursor) : pageQuery.lt('id', cursor);
  // ¿Hay filas del lado del que se vino? `cursor` es la fila límite de la página anterior, así que se incluye.
  const probe =
    cursor === undefined
      ? null
      : (prev ? filtered('id').lte('id', cursor) : filtered('id').gte('id', cursor)).limit(1);

  const [{ data, error }, probeResult] = await Promise.all([pageQuery.limit(pageSize + 1), probe]);

  if (error) {
    throw new Error(`Error al consultar la auditoría: ${error.message}`);
  }
  if (probeResult?.error) {
    throw new Error(`Error al consultar la auditoría: ${probeResult.error.message}`);
  }

  const rows = (data ?? []) as unknown as AuditRow[];
  const hasMore = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const visibleRows = prev ? pageRows.reverse() : pageRows;
  const hasOtherSide = (probeResult?.data ?? []).length > 0;
  const hasNextPage = visibleRows.length > 0 && (prev ? hasOtherSide : hasMore);
  const hasPrevPage = visibleRows.length > 0 && (prev ? hasMore : hasOtherSide);
  const names = await resolveAuditTargetNames(supabase, visibleRows);

  return {
    items: visibleRows.map((row) => toAuditLogItem(row, names)),
    pageSize,
    nextCursor: hasNextPage ? visibleRows[visibleRows.length - 1]?.id ?? null : null,
    hasNextPage,
    prevCursor: hasPrevPage ? visibleRows[0]?.id ?? null : null,
    hasPrevPage,
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

  const rows = (data ?? []) as unknown as AuditRow[];
  const names = await resolveAuditTargetNames(supabase, rows);
  return rows.map((row) => toAuditLogItem(row, names));
}

/**
 * T-402: nombre del admin de la sesión para el pie de la barra lateral. Es un dato de lectura: si falta o la base
 * falla, el panel muestra «Operador sin nombre» en vez de romperse.
 */
export async function getAdminOperatorName(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ADMIN_COPY.audit.unnamedOperator;

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle<{ display_name: string | null }>();
  if (error) return ADMIN_COPY.audit.unnamedOperator;
  return data?.display_name?.trim() || ADMIN_COPY.audit.unnamedOperator;
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

// ---------------------------------------------------------------------------
// CC-029 (T-369): créditos de publicación y catálogo de planes
// ---------------------------------------------------------------------------

const PUBLICATION_PLANS_PAGE_SIZE = 50;

/**
 * Catálogo de planes, de a 50, por `admin_list_publication_plans` con la sesión (CC-029 addendum D01-B): la RPC exige
 * admin con AAL2 y la tabla sigue cerrada para `authenticated`. Orden `(sort, id)` y cursor de la última fila.
 */
export async function getPublicationPlans(
  query: Partial<PublicationPlansQuery> = {}
): Promise<ActionResult<PublicationPlansPage, DomainErrorCode>> {
  const supabase = await createClient();
  return adminListPublicationPlansRpc(supabase, {
    limit: PUBLICATION_PLANS_PAGE_SIZE,
    activeOnly: query.activeOnly ?? false,
    afterSort: query.after?.sort ?? null,
    afterId: query.after?.id ?? null,
  });
}

const publicationPlansParamsSchema = z.object({
  afterSort: z.coerce.number().int().min(0).max(1000),
  afterId: z.string().guid(),
});

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lee la página del catálogo desde la URL (`?active=1&afterSort=..&afterId=..`). Un cursor incompleto o inválido se
 * ignora y vuelve a la primera página; nunca llega a la RPC.
 */
export function parsePublicationPlansParams(raw: {
  readonly active?: string | string[];
  readonly afterSort?: string | string[];
  readonly afterId?: string | string[];
}): PublicationPlansQuery {
  const cursor = publicationPlansParamsSchema.safeParse({
    afterSort: firstParam(raw.afterSort),
    afterId: firstParam(raw.afterId),
  });
  return {
    activeOnly: firstParam(raw.active) === '1',
    after: cursor.success ? { sort: cursor.data.afterSort, id: cursor.data.afterId } : null,
  };
}

/** T-401: un comercio con el alta sin completar (`business_name` vacío) nunca se muestra con nombre vacío. */
function merchantDisplayName(businessName: string): string {
  return businessName.trim() || ADMIN_COPY.merchants.incompleteSignup;
}

/** Nombre del comercio para el encabezado del detalle de créditos (RLS de admin). */
export async function getAdminMerchantHeader(merchantId: string): Promise<AdminMerchantHeader | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('merchants')
    .select('profile_id, business_name')
    .eq('profile_id', merchantId)
    .maybeSingle<{ profile_id: string; business_name: string }>();
  if (error) {
    throw new Error(`Error al consultar el comercio: ${error.message}`);
  }
  return data ? { id: data.profile_id, businessName: merchantDisplayName(data.business_name) } : null;
}

/** Saldo, plan y libro paginado de un comercio vía `admin_get_merchant_publication_credits` (AAL2 en la RPC). */
export async function getAdminMerchantPublicationCredits(input: {
  readonly merchantId: string;
  readonly beforeId?: number | null;
}): Promise<ActionResult<RpcOutput<'admin_get_merchant_publication_credits'>, DomainErrorCode>> {
  const supabase = await createClient();
  return adminGetMerchantPublicationCreditsRpc(supabase, {
    merchantId: input.merchantId,
    limit: 50,
    beforeId: input.beforeId ?? null,
  });
}
