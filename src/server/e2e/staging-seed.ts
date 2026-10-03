import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env.public';
import { createAdminClient } from '@/server/supabase/admin';
import type { Database } from '@/types/database.types';

export interface UserCredentials {
  id: string;
  email: string;
  password: string;
  role: 'merchant' | 'courier' | 'admin';
  displayName?: string;
  phone?: string;
}

export interface StagingSeedContext {
  testRunId: string;
  createdRequestIds: string[];
  createdOfferIds: string[];
  createdUserIds: string[];
  createdZoneIds: string[];
  createdContactRequestIds?: string[];
  createdIncidentIds?: string[];
  merchantUser?: UserCredentials;
  courierUsers?: UserCredentials[];
  adminUser?: UserCredentials;
  sentinelPhone?: string;
}

export interface SeedStagingOptions {
  requestsCount?: number;
  merchantId?: string;
  pickupZoneId?: string;
  dropoffZoneId?: string;
  withMerchant?: boolean;
  couriersCount?: number;
  withAdmin?: boolean;
  recipientPhone?: string;
  recipientName?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  withContacts?: boolean;
  createOffersForFirstRequest?: boolean;
}

export interface EnvironmentCheckResult {
  allowed: boolean;
  reason?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida si un string cumple el formato estándar UUID v4.
 */
export function isValidUuid(value: string | undefined | null): boolean {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

/**
 * Lanza un error estricto de esquema si el identificador no es un UUID válido.
 * Garantiza que columnas de tipo uuid en PostgreSQL nunca reciban strings arbitrarios.
 */
export function assertValidUuid(value: string | undefined | null, fieldName: string): void {
  if (!isValidUuid(value)) {
    throw new Error(
      `[E2E Schema Error] El campo '${fieldName}' debe ser un UUID válido. Recibido: '${value}'`
    );
  }
}

/**
 * Project ref conocido del entorno remoto de staging de cadeApp (documentado en PR #51 y migrate.yml).
 */
export const KNOWN_STAGING_PROJECT_REFS = ['axwvmyqwhwfghyjdufny'];
export const PLACEHOLDER_TEST_PROJECT_REFS = ['placeholderprojectref'];

/**
 * Extrae el project ref de una URL de Supabase (*.supabase.co).
 */
export function parseSupabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.trim().match(/^https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
  return match && match[1] ? match[1].toLowerCase() : null;
}

/**
 * Determina si una URL apunta a una instancia local de Supabase (Docker / local dev).
 */
export function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^http:\/\/(127\.0\.0\.1|localhost):54321(\/.*)?$/i.test(url.trim());
}

/**
 * Evalúa si el entorno actual está expresamente autorizado para operaciones E2E de staging/test.
 *
 * Política FAIL-CLOSED estricta:
 * 1. Producción conocida (por flags, URLs o project ref de prod) queda bloqueada incondicionalmente.
 * 2. Un proyecto Supabase desconocido o no verificado queda bloqueado (fail-closed por defecto).
 *    NODE_ENV=test, ALLOW_E2E_STAGING=true o VERCEL_ENV=preview NO pueden autorizar proyectos desconocidos o producción.
 * 3. Solo se autoriza si el proyecto Supabase está positivamente identificado como staging (o local)
 *    Y cuenta con habilitación afirmativa de E2E.
 */
export function isAllowedE2EEnvironment(
  env: Record<string, string | undefined> = process.env
): EnvironmentCheckResult {
  // 1. Bloqueo incondicional de producción conocida
  if (env.VERCEL_ENV === 'production') {
    return { allowed: false, reason: 'VERCEL_ENV es production (bloqueado incondicionalmente)' };
  }
  if (env.APP_ENV === 'production') {
    return { allowed: false, reason: 'APP_ENV es production (bloqueado incondicionalmente)' };
  }

  const appUrl = (env.NEXT_PUBLIC_APP_URL || env.APP_URL || '').toLowerCase().trim();
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').toLowerCase().trim();
  const targetProjectRef = parseSupabaseProjectRef(supabaseUrl);

  // Verificación de URL de aplicación
  if (
    appUrl.includes('cadeapp.com') &&
    !appUrl.includes('staging.cadeapp.com') &&
    !appUrl.includes('cadeapp-staging')
  ) {
    return { allowed: false, reason: 'NEXT_PUBLIC_APP_URL apunta a dominio de producción' };
  }

  // Verificación de project ref de producción configurado en CI/entorno
  const prodProjectRef = (env.SUPABASE_PRODUCTION_PROJECT_REF || '').toLowerCase().trim();
  if (prodProjectRef && targetProjectRef && prodProjectRef === targetProjectRef) {
    return {
      allowed: false,
      reason: 'NEXT_PUBLIC_SUPABASE_URL coincide con SUPABASE_PRODUCTION_PROJECT_REF (bloqueado por seguridad)',
    };
  }

  if (supabaseUrl.includes('cadeapp-prod')) {
    return { allowed: false, reason: 'NEXT_PUBLIC_SUPABASE_URL apunta a proyecto de producción' };
  }

  // 2. Identificación afirmativa y positiva de Staging o Local
  const isLocal = isLocalSupabaseUrl(supabaseUrl);

  const configuredStagingRef = (
    env.SUPABASE_STAGING_PROJECT_REF ||
    env.SUPABASE_PROJECT_REF ||
    ''
  )
    .toLowerCase()
    .trim();

  const isPositivelyIdentifiedStaging =
    Boolean(targetProjectRef) &&
    ((Boolean(configuredStagingRef) && targetProjectRef === configuredStagingRef) ||
      (targetProjectRef !== null && KNOWN_STAGING_PROJECT_REFS.includes(targetProjectRef)) ||
      (targetProjectRef !== null && PLACEHOLDER_TEST_PROJECT_REFS.includes(targetProjectRef) && env.NODE_ENV === 'test'));

  if (!isLocal && !isPositivelyIdentifiedStaging) {
    return {
      allowed: false,
      reason: `Proyecto Supabase '${targetProjectRef || supabaseUrl || 'desconocido'}' no está positivamente identificado como staging (fail-closed)`,
    };
  }

  // 3. Verificación de habilitación E2E afirmativa
  const isE2EEnabled =
    env.E2E_TEST === 'true' ||
    env.ALLOW_E2E_STAGING === 'true' ||
    env.CI === 'true' ||
    env.NODE_ENV === 'test';

  if (!isE2EEnabled) {
    return {
      allowed: false,
      reason:
        'Falta habilitación explícita de E2E (E2E_TEST=true o ALLOW_E2E_STAGING=true) en el entorno de staging',
    };
  }

  return { allowed: true };
}

/**
 * Lanza un error si el entorno actual no está expresamente autorizado para operaciones de seed/cleanup E2E.
 */
export function assertAllowedE2EEnvironment(
  env: Record<string, string | undefined> = process.env
): void {
  const result = isAllowedE2EEnvironment(env);
  if (!result.allowed) {
    throw new Error(`[E2E Fail-Closed] Operación prohibida: ${result.reason}`);
  }
}

/**
 * Inicializa un contexto de datos para la corrida de un spec E2E con prefijo único.
 */
export function createStagingSeedContext(): StagingSeedContext {
  const testRunId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    testRunId,
    createdRequestIds: [],
    createdOfferIds: [],
    createdUserIds: [],
    createdZoneIds: [],
    createdContactRequestIds: [],
    createdIncidentIds: [],
    courierUsers: [],
  };
}

/**
 * Registra entidades creadas durante la prueba para asegurar su limpieza posterior acotada.
 * Exige estrictamente que el ID sea un UUID válido.
 */
export function trackEntityForCleanup(
  context: StagingSeedContext,
  type: 'request' | 'offer' | 'user' | 'zone' | 'contact' | 'incident',
  id: string
): void {
  assertValidUuid(id, `trackEntityForCleanup(${type})`);
  if (type === 'request') {
    if (!context.createdRequestIds.includes(id)) context.createdRequestIds.push(id);
  } else if (type === 'offer') {
    if (!context.createdOfferIds.includes(id)) context.createdOfferIds.push(id);
  } else if (type === 'user') {
    if (!context.createdUserIds.includes(id)) context.createdUserIds.push(id);
  } else if (type === 'zone') {
    if (!context.createdZoneIds.includes(id)) context.createdZoneIds.push(id);
  } else if (type === 'contact') {
    if (!context.createdContactRequestIds) context.createdContactRequestIds = [];
    if (!context.createdContactRequestIds.includes(id)) context.createdContactRequestIds.push(id);
  } else if (type === 'incident') {
    if (!context.createdIncidentIds) context.createdIncidentIds = [];
    if (!context.createdIncidentIds.includes(id)) context.createdIncidentIds.push(id);
  }
}

export type AdminClientType = ReturnType<typeof createAdminClient>;

/**
 * Crea datos transitorios mínimos reales en Supabase staging vinculados al testRunId.
 * Garantías:
 * - Valida entorno con assertAllowedE2EEnvironment() (Fail-Closed).
 * - Genera y valida UUIDs reales en todas las columnas UUID.
 * - Asegura que toda foreign key referencie registros válidos creados/verificados en la base.
 * - Si Supabase devuelve error, FALLA y no registra entidades inexistentes.
 * - Solo registra en context.createdRequestIds tras confirmar la inserción exitosa.
 */
export async function seedStagingData(
  context: StagingSeedContext,
  options?: SeedStagingOptions,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<StagingSeedContext> {
  assertAllowedE2EEnvironment(env);

  const count = options?.requestsCount ?? 0;
  const shouldCreateMerchant = options?.withMerchant || (count > 0 && !options?.merchantId);
  const couriersCount = options?.couriersCount ?? 0;
  const withAdmin = Boolean(options?.withAdmin);

  if (count <= 0 && !shouldCreateMerchant && couriersCount <= 0 && !withAdmin) {
    return context;
  }

  const admin = client ?? createAdminClient();

  // 1. Resolver zonas de origen y destino con UUIDs válidos
  let pickupZoneId = options?.pickupZoneId;
  let dropoffZoneId = options?.dropoffZoneId;

  if (pickupZoneId && dropoffZoneId) {
    assertValidUuid(pickupZoneId, 'options.pickupZoneId');
    assertValidUuid(dropoffZoneId, 'options.dropoffZoneId');
  } else {
    // Buscar zonas activas en la base
    const { data: existingZones, error: zonesQueryError } = await admin
      .from('zones')
      .select('id, name')
      .eq('active', true)
      .limit(10);

    if (zonesQueryError) {
      throw new Error(`[E2E Seed Error] Error al consultar zonas: ${zonesQueryError.message}`);
    }

    // Nunca reutilizar zonas transitorias creadas por otra corrida E2E paralela.
    // Si staging no tiene zonas estables, cada contexto crea y trackea su propia zona.
    const stableZones = (existingZones ?? []).filter(
      (zone) => typeof zone.name !== 'string' || !zone.name.startsWith('E2E Zona ')
    );
    const firstZone = stableZones[0];
    if (firstZone) {
      pickupZoneId = firstZone.id;
      dropoffZoneId = stableZones[1]?.id ?? firstZone.id;
    } else {
      // Si la base no tiene zonas activas preexistentes, crear una zona transitoria válida
      const newZoneId = crypto.randomUUID();
      assertValidUuid(newZoneId, 'newZoneId');

      const { data: createdZone, error: createZoneErr } = await admin
        .from('zones')
        .insert({
          id: newZoneId,
          name: `E2E Zona ${context.testRunId}`,
          centroid_lat: -27.43,
          centroid_lng: -65.61,
          active: true,
        })
        .select('id')
        .single();

      if (createZoneErr || !createdZone?.id) {
        throw new Error(
          `[E2E Seed Error] No se pudo crear zona de prueba: ${createZoneErr?.message || 'Sin datos'}`
        );
      }

      trackEntityForCleanup(context, 'zone', createdZone.id);
      pickupZoneId = createdZone.id;
      dropoffZoneId = createdZone.id;
    }
  }

  assertValidUuid(pickupZoneId, 'pickupZoneId');
  assertValidUuid(dropoffZoneId, 'dropoffZoneId');

  // 2. Resolver comercio con UUID válido y registros en auth.users, profiles y merchants
  let merchantId = options?.merchantId;
  if (merchantId) {
    assertValidUuid(merchantId, 'options.merchantId');
  } else if (shouldCreateMerchant) {
    const merchantEmail = `e2e_${context.testRunId}_merchant@cadeapp-staging.test`;
    const merchantPassword = `P@ssword_${crypto.randomUUID()}!`;
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: merchantEmail,
      password: merchantPassword,
      email_confirm: true,
      user_metadata: {
        role: 'merchant',
        display_name: `E2E Merchant ${context.testRunId}`,
        phone: '+5491112345678',
      },
    });

    if (authError || !authData?.user?.id) {
      throw new Error(
        `[E2E Seed Error] No se pudo crear usuario comerciante para E2E: ${authError?.message || 'Sin usuario retornado'}`
      );
    }

    const createdUserId = authData.user.id;
    assertValidUuid(createdUserId, 'createdUserId');
    trackEntityForCleanup(context, 'user', createdUserId);

    // Asegurar filas en profiles y merchants con consent_status active
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: createdUserId,
      role: 'merchant',
      display_name: `E2E Merchant ${context.testRunId}`,
      phone: '+5491112345678',
      consent_status: 'active',
    });
    if (profileErr) {
      throw new Error(`[E2E Seed Error] Falló el upsert en profiles: ${profileErr.message}`);
    }

    const { error: merchantErr } = await admin.from('merchants').upsert({
      profile_id: createdUserId,
      business_name: `E2E Comercio ${context.testRunId}`,
      default_pickup_zone_id: pickupZoneId,
      default_pickup_address: options?.pickupAddress ?? 'Alberdi 150, Aguilares',
      default_pickup_lat: -27.432,
      default_pickup_lng: -65.612,
    });
    if (merchantErr) {
      throw new Error(`[E2E Seed Error] Falló el upsert en merchants: ${merchantErr.message}`);
    }

    // Credenciales en memoria únicamente
    context.merchantUser = {
      id: createdUserId,
      email: merchantEmail,
      password: merchantPassword,
      role: 'merchant',
      displayName: `E2E Merchant ${context.testRunId}`,
      phone: '+5491112345678',
    };
    merchantId = createdUserId;
  }

  // 3. Crear repartidores autenticables y aptos para ofertar (T-303)
  if (couriersCount > 0) {
    if (!context.courierUsers) {
      context.courierUsers = [];
    }
    const currentCouriers = context.courierUsers;
    const startIndex = currentCouriers.length;
    for (let i = startIndex; i < couriersCount; i++) {
      const courierEmail = `e2e_${context.testRunId}_courier_${i}@cadeapp-staging.test`;
      const courierPassword = `P@ssword_${crypto.randomUUID()}!`;
      const displayName =
        i === 0
          ? `E2E Courier Doc2 ${context.testRunId}`
          : `E2E Courier Doc0 ${context.testRunId}`;
      const courierPhone = `+549386500000${i + 1}`;

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: courierEmail,
        password: courierPassword,
        email_confirm: true,
        user_metadata: {
          role: 'courier',
          display_name: displayName,
          phone: courierPhone,
        },
      });

      if (authError || !authData?.user?.id) {
        throw new Error(
          `[E2E Seed Error] No se pudo crear usuario repartidor ${i}: ${authError?.message || 'Sin usuario retornado'}`
        );
      }

      const courierUserId = authData.user.id;
      assertValidUuid(courierUserId, 'courierUserId');
      trackEntityForCleanup(context, 'user', courierUserId);

      // Perfil con consent_status active
      const { error: courierProfErr } = await admin.from('profiles').upsert({
        id: courierUserId,
        role: 'courier',
        display_name: displayName,
        phone: courierPhone,
        consent_status: 'active',
      });
      if (courierProfErr) {
        throw new Error(
          `[E2E Seed Error] Falló el upsert en profiles (courier ${i}): ${courierProfErr.message}`
        );
      }

      // Courier habilitado para ofertar. Courier 0: doc_level 2, Courier 1: doc_level 0
      const isDoc2 = i === 0;
      const { error: courierRowErr } = await admin.from('couriers').upsert({
        profile_id: courierUserId,
        status: 'approved',
        available: true,
        vehicle_type: 'moto',
        vehicle_plate: `E2E-${i}`,
        license_status: isDoc2 ? 'verified' : 'none',
        insurance_status: isDoc2 ? 'verified' : 'none',
      });
      if (courierRowErr) {
        throw new Error(
          `[E2E Seed Error] Falló el upsert en couriers (${i}): ${courierRowErr.message}`
        );
      }

      // Guardar credenciales estrictamente en memoria del contexto
      if (!context.courierUsers) context.courierUsers = [];
      context.courierUsers.push({
        id: courierUserId,
        email: courierEmail,
        password: courierPassword,
        role: 'courier',
        displayName,
        phone: courierPhone,
      });
    }
  }

  // 4. Crear solicitudes de envío reales con UUIDs válidos y contactos asociados
  if (count > 0 && merchantId) {
    assertValidUuid(merchantId, 'merchantId');

    for (let i = 0; i < count; i++) {
      const requestId = crypto.randomUUID();
      assertValidUuid(requestId, 'requestId');

      const { data, error } = await admin
        .from('delivery_requests')
        .insert({
          id: requestId,
          merchant_id: merchantId,
          pickup_zone_id: pickupZoneId,
          dropoff_zone_id: dropoffZoneId,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          status: 'published',
          published_at: new Date().toISOString(),
          notes: `E2E automated test run ${context.testRunId}`,
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        throw new Error(
          `[E2E Seed Error] Falló la inserción en delivery_requests: ${error?.message || 'Sin ID devuelto'}`
        );
      }

      assertValidUuid(data.id, 'insertedRequestId');
      trackEntityForCleanup(context, 'request', data.id);

      // Contactos del destinatario reales cuando el caso lo necesita
      if (options?.withContacts || options?.recipientPhone) {
        const recipientPhone = options?.recipientPhone ?? '+5493865123456';
        context.sentinelPhone = recipientPhone;
        const recipientName = options?.recipientName ?? 'Destinatario E2E';

        const { error: contactErr } = await admin.from('delivery_request_contacts').insert({
          request_id: data.id,
          pickup_address: options?.pickupAddress ?? 'Alberdi 150, Aguilares',
          pickup_lat: -27.432,
          pickup_lng: -65.612,
          dropoff_address: options?.dropoffAddress ?? 'San Martín 400, Aguilares',
          dropoff_lat: -27.435,
          dropoff_lng: -65.615,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          recipient_consent_declared: true,
        });

        if (contactErr) {
          throw new Error(
            `[E2E Seed Error] Falló la inserción en delivery_request_contacts: ${contactErr.message}`
          );
        }

        trackEntityForCleanup(context, 'contact', data.id);
      }
    }

    // 5. Crear ofertas reales de prueba para sorting / concurrencia si se solicitó explícitamente
    if (options?.createOffersForFirstRequest) {
      await seedOffersForFirstRequest(context, admin, env);
    }
  }

  if (withAdmin) {
    await seedAdminUser(context, admin, env);
  }

  return context;
}

/**
 * Crea dos ofertas reales de prueba para sorting / concurrencia sobre la primera solicitud creada.
 * Courier 0: Doc 2, monto $2000, eta 15 min, mensaje 'Voy en moto', status 'pending'.
 * Courier 1: Doc 0, monto $1500, eta 10 min, mensaje 'Estoy a 5 cuadras', status 'pending'.
 * Ambas ofertas quedan registradas en context.createdOfferIds para su cleanup.
 */
export async function seedOffersForFirstRequest(
  context: StagingSeedContext,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<StagingSeedContext> {
  assertAllowedE2EEnvironment(env);

  const targetReqId = context.createdRequestIds[0];
  if (!targetReqId) {
    throw new Error('[E2E Seed Error] No hay solicitudes creadas en el contexto para ofertar');
  }

  const couriers = context.courierUsers ?? [];
  const firstCourier = couriers[0];
  const secondCourier = couriers[1];
  if (!firstCourier || !secondCourier) {
    throw new Error('[E2E Seed Error] Se requieren al menos 2 repartidores en el contexto para precrear ofertas');
  }

  const admin = client ?? createAdminClient();

  // Oferta 1: Courier 0 (Doc 2, monto $2000)
  const offer0Id = crypto.randomUUID();
  assertValidUuid(offer0Id, 'offer0Id');
  const { error: off0Err } = await admin.from('offers').insert({
    id: offer0Id,
    request_id: targetReqId,
    courier_id: firstCourier.id,
    amount_ars: 2000,
    eta_minutes: 15,
    message: 'Voy en moto',
    status: 'pending',
  });
  if (off0Err) {
    throw new Error(`[E2E Seed Error] Falló la creación de oferta 0: ${off0Err.message}`);
  }
  trackEntityForCleanup(context, 'offer', offer0Id);

  // Oferta 2: Courier 1 (Doc 0, monto $1500)
  const offer1Id = crypto.randomUUID();
  assertValidUuid(offer1Id, 'offer1Id');
  const { error: off1Err } = await admin.from('offers').insert({
    id: offer1Id,
    request_id: targetReqId,
    courier_id: secondCourier.id,
    amount_ars: 1500,
    eta_minutes: 10,
    message: 'Estoy a 5 cuadras',
    status: 'pending',
  });
  if (off1Err) {
    throw new Error(`[E2E Seed Error] Falló la creación de oferta 1: ${off1Err.message}`);
  }
  trackEntityForCleanup(context, 'offer', offer1Id);

  return context;
}

export interface RequestFinalInspectionData {
  requestId: string;
  requestStatus: string;
  acceptedOfferId: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  matchedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  offers: Array<{
    id: string;
    status: string;
    courierId: string;
    amountArs: number;
  }>;
  incidents?: Array<{
    id: string;
    status: string;
    kind: string;
    reporterId: string;
  }>;
  cancellationReasons?: Array<{
    id: string;
    requestId: string;
    offerId: string | null;
    actorId: string;
    action: string;
    reason: string;
  }>;
}

/**
 * Consulta server-side el estado final de una solicitud y sus ofertas asociadas.
 * Acotado estrictamente a los IDs rastreados por la corrida E2E en context.
 * La service-role se utiliza exclusivamente en el entorno de ejecución Node/Server.
 */
export async function getRequestInspectionData(
  context: StagingSeedContext,
  requestId: string,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<RequestFinalInspectionData> {
  assertAllowedE2EEnvironment(env);
  assertValidUuid(requestId, 'requestId');

  if (!context.createdRequestIds.includes(requestId)) {
    throw new Error(
      `[E2E Inspection Error] La solicitud '${requestId}' no pertenece a la corrida '${context.testRunId}'`
    );
  }

  const admin = client ?? createAdminClient();

  const { data: requestData, error: reqErr } = await admin
    .from('delivery_requests')
    .select(
      'id, status, accepted_offer_id, published_at, expires_at, matched_at, picked_up_at, delivered_at, cancelled_at, cancel_reason'
    )
    .eq('id', requestId)
    .single();

  if (reqErr || !requestData) {
    throw new Error(
      `[E2E Inspection Error] Error al consultar delivery_requests: ${reqErr?.message ?? 'Sin datos'}`
    );
  }

  const { data: offersData, error: offErr } = await admin
    .from('offers')
    .select('id, status, courier_id, amount_ars')
    .eq('request_id', requestId);

  if (offErr) {
    throw new Error(`[E2E Inspection Error] Error al consultar offers: ${offErr.message}`);
  }

  const offers = (offersData ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    courierId: row.courier_id,
    amountArs: row.amount_ars,
  }));

  let incidentsData: unknown = null;
  try {
    const { data, error: incErr } = await admin
      .from('incidents')
      .select('id, status, kind, reporter_id')
      .eq('request_id', requestId);

    if (incErr) {
      throw new Error(`[E2E Inspection Error] Error al consultar incidents: ${incErr.message}`);
    }
    incidentsData = data;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('[E2E Inspection Error]')) {
      throw err;
    }
    throw new Error(
      `[E2E Inspection Error] Error inesperado al consultar incidents: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const incidents = (
    (incidentsData as Array<{ id: string; status: string; kind: string; reporter_id: string }> | null) ?? []
  ).map((row) => ({
    id: row.id,
    status: row.status,
    kind: row.kind,
    reporterId: row.reporter_id,
  }));

  let reasonsData: unknown = null;
  try {
    const { data, error: crErr } = await admin
      .from('request_cancellation_reasons')
      .select('id, request_id, offer_id, actor_id, action, reason')
      .eq('request_id', requestId);

    if (crErr) {
      throw new Error(
        `[E2E Inspection Error] Error al consultar request_cancellation_reasons: ${crErr.message}`
      );
    }
    reasonsData = data;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('[E2E Inspection Error]')) {
      throw err;
    }
    throw new Error(
      `[E2E Inspection Error] Error inesperado al consultar request_cancellation_reasons: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const cancellationReasons = (
    (reasonsData as Array<{
      id: string;
      request_id: string;
      offer_id: string | null;
      actor_id: string;
      action: string;
      reason: string;
    }> | null) ?? []
  ).map((row) => ({
    id: row.id,
    requestId: row.request_id,
    offerId: row.offer_id,
    actorId: row.actor_id,
    action: row.action,
    reason: row.reason,
  }));

  const rawReq = requestData as Record<string, unknown>;

  return {
    requestId: requestData.id,
    requestStatus: requestData.status,
    acceptedOfferId: requestData.accepted_offer_id,
    publishedAt: (rawReq.published_at as string | null) ?? null,
    expiresAt: (rawReq.expires_at as string | null) ?? null,
    matchedAt: (rawReq.matched_at as string | null) ?? null,
    pickedUpAt: (rawReq.picked_up_at as string | null) ?? null,
    deliveredAt: (rawReq.delivered_at as string | null) ?? null,
    cancelledAt: (rawReq.cancelled_at as string | null) ?? null,
    cancelReason: (rawReq.cancel_reason as string | null) ?? null,
    offers,
    incidents,
    cancellationReasons,
  };
}

/**
 * Busca de forma determinística y unívoca una solicitud creada en la corrida
 * a partir del merchant_id y del marcador exacto en el campo notes.
 * Falla cerrado si no se encuentra exactamente una fila o si el UUID es inválido.
 * Incorpora el ID al tracking de la corrida si aún no estaba presente.
 */
export async function findRequestIdByNotesMarker(
  context: StagingSeedContext,
  marker: string,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<string> {
  assertAllowedE2EEnvironment(env);

  if (!context.merchantUser?.id) {
    throw new Error(
      '[E2E Error] Se requiere context.merchantUser para buscar solicitudes por marcador de notas'
    );
  }

  const admin = client ?? createAdminClient();
  const { data, error } = await admin
    .from('delivery_requests')
    .select('id')
    .eq('merchant_id', context.merchantUser.id)
    .eq('notes', marker);

  if (error) {
    throw new Error(`[E2E Error] Error al consultar delivery_requests por notas: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(
      `[E2E Error] No se encontró ninguna solicitud para el marcador de notas: "${marker}"`
    );
  }

  if (data.length > 1) {
    throw new Error(
      `[E2E Error] Se encontraron múltiples solicitudes (${data.length}) para el marcador de notas: "${marker}"`
    );
  }

  const foundId = data[0]?.id;
  if (!foundId) {
    throw new Error('[E2E Error] La fila devuelta no posee un campo id válido');
  }

  assertValidUuid(foundId, 'findRequestIdByNotesMarker');

  if (!context.createdRequestIds.includes(foundId)) {
    context.createdRequestIds.push(foundId);
  }

  return foundId;
}

/**
 * Limpia exclusivamente los registros creados por esta ejecución E2E.
 * Respeta el orden relacional inverso:
 * 0. desvincular accepted_offer_id en delivery_requests
 * 1. offers
 * 2. delivery_request_contacts
 * 3. delivery_requests
 * 3a. rate_limits (usuarios creados por la corrida)
 * 3b. audit_log (actor y target delivery_request antes de borrar profiles)
 * 4. couriers, merchants y profiles
 * 5. zones creadas por la corrida
 * 6. auth users
 * Tolera fallos parciales, conserva los IDs fallidos y reporta error agregado.
 */
export async function cleanupStagingData(
  context: StagingSeedContext | string[],
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  assertAllowedE2EEnvironment(env);

  if (Array.isArray(context)) {
    if (context.length === 0) return;
    for (const id of context) {
      assertValidUuid(id, 'cleanupDirectId');
    }
    const admin = client ?? createAdminClient();
    try {
      const { error } = await admin.from('delivery_requests').delete().in('id', context);
      if (error) {
        throw new Error(`Error en delete delivery_requests: ${error.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[E2E Cleanup Error] Falló la limpieza directa: ${msg}`);
    }
    return;
  }

  const admin = client ?? createAdminClient();
  const cleanupErrors: Array<{ entity: string; ids: string[]; error: string }> = [];

  // Discovery dinámico: entidades creadas por UI u operaciones posteriores al seed
  // 1. Descubrir todas las delivery_requests del merchant de la corrida
  if (context.merchantUser?.id) {
    try {
      const reqBuilder = admin.from('delivery_requests');
      if (typeof (reqBuilder as { select?: unknown }).select === 'function') {
        const { data: merchantReqs, error: merchReqsErr } = await reqBuilder
          .select('id')
          .eq('merchant_id', context.merchantUser.id);

        if (merchReqsErr) {
          cleanupErrors.push({
            entity: 'discovery.delivery_requests',
            ids: [context.merchantUser.id],
            error: merchReqsErr.message,
          });
        } else if (merchantReqs) {
          for (const row of merchantReqs) {
            if (row.id && !context.createdRequestIds.includes(row.id)) {
              context.createdRequestIds.push(row.id);
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('Unexpected table delivery_requests') && !msg.includes('Unexpected table: delivery_requests')) {
        cleanupErrors.push({
          entity: 'discovery.delivery_requests',
          ids: [context.merchantUser.id],
          error: msg,
        });
      }
    }
  }

  // 2. Descubrir ofertas asociadas a todos los request IDs de la corrida
  if (context.createdRequestIds.length > 0) {
    try {
      const offersBuilder = admin.from('offers');
      if (typeof (offersBuilder as { select?: unknown }).select === 'function') {
        const { data: foundOffers, error: offersErr } = await offersBuilder
          .select('id')
          .in('request_id', context.createdRequestIds);

        if (offersErr) {
          cleanupErrors.push({
            entity: 'discovery.offers',
            ids: context.createdRequestIds,
            error: offersErr.message,
          });
        } else if (foundOffers) {
          for (const row of foundOffers) {
            if (row.id && !context.createdOfferIds.includes(row.id)) {
              context.createdOfferIds.push(row.id);
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('Unexpected table offers') && !msg.includes('Unexpected table: offers')) {
        cleanupErrors.push({
          entity: 'discovery.offers',
          ids: context.createdRequestIds,
          error: msg,
        });
      }
    }

  // 3. Descubrir contactos correspondientes
  try {
    const contactsBuilder = admin.from('delivery_request_contacts');
    if (typeof (contactsBuilder as { select?: unknown }).select === 'function') {
      const { data: foundContacts, error: contactsErr } = await contactsBuilder
        .select('request_id')
        .in('request_id', context.createdRequestIds);

      if (contactsErr) {
        cleanupErrors.push({
          entity: 'discovery.delivery_request_contacts',
          ids: context.createdRequestIds,
          error: contactsErr.message,
        });
      } else if (foundContacts) {
        if (!context.createdContactRequestIds) {
          context.createdContactRequestIds = [];
        }
        for (const row of foundContacts) {
          if (row.request_id && !context.createdContactRequestIds.includes(row.request_id)) {
            context.createdContactRequestIds.push(row.request_id);
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('Unexpected table delivery_request_contacts') && !msg.includes('Unexpected table: delivery_request_contacts')) {
      cleanupErrors.push({
        entity: 'discovery.delivery_request_contacts',
        ids: context.createdRequestIds,
        error: msg,
      });
    }
  }

    // 3b. Descubrir incidentes creados para las solicitudes de la corrida (H11)
    try {
      const incidentsBuilder = admin.from('incidents');
      if (typeof (incidentsBuilder as { select?: unknown }).select === 'function') {
        const { data: foundIncidents, error: incidentsErr } = await incidentsBuilder
          .select('id')
          .in('request_id', context.createdRequestIds);

        if (incidentsErr) {
          cleanupErrors.push({
            entity: 'discovery.incidents',
            ids: context.createdRequestIds,
            error: incidentsErr.message,
          });
        } else if (foundIncidents) {
          if (!context.createdIncidentIds) {
            context.createdIncidentIds = [];
          }
          for (const row of foundIncidents) {
            if (row.id && !context.createdIncidentIds.includes(row.id)) {
              context.createdIncidentIds.push(row.id);
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('Unexpected table incidents') && !msg.includes('Unexpected table: incidents')) {
        cleanupErrors.push({
          entity: 'discovery.incidents',
          ids: context.createdRequestIds,
          error: msg,
        });
      }
    }
  }

  // 0. Desvincular accepted_offer_id si hubiera quedado fijado
  if (context.createdRequestIds.length > 0) {
    try {
      const reqBuilder = admin.from('delivery_requests');
      if (typeof (reqBuilder as { update?: unknown }).update === 'function') {
        const { error: unlinkErr } = await reqBuilder
          .update({ accepted_offer_id: null })
          .in('id', context.createdRequestIds);

        if (unlinkErr) {
          cleanupErrors.push({
            entity: 'delivery_requests.unlink_accepted_offer',
            ids: context.createdRequestIds,
            error: unlinkErr.message,
          });
        }
      }
    } catch (err: unknown) {
      cleanupErrors.push({
        entity: 'delivery_requests.unlink_accepted_offer',
        ids: context.createdRequestIds,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 0b. Limpieza de incidents (H11: debe eliminarse antes de delivery_requests y profiles)
  if (context.createdIncidentIds && context.createdIncidentIds.length > 0) {
    const toDelete = [...context.createdIncidentIds];
    try {
      const { error } = await admin.from('incidents').delete().in('id', toDelete);
      if (error) {
        cleanupErrors.push({ entity: 'incidents', ids: toDelete, error: error.message });
      } else {
        context.createdIncidentIds = context.createdIncidentIds.filter((id) => !toDelete.includes(id));
      }
    } catch (err: unknown) {
      cleanupErrors.push({
        entity: 'incidents',
        ids: toDelete,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 1. Limpieza de ofertas
  if (context.createdOfferIds.length > 0) {
    const toDelete = [...context.createdOfferIds];
    try {
      const { error } = await admin.from('offers').delete().in('id', toDelete);
      if (error) {
        cleanupErrors.push({ entity: 'offers', ids: toDelete, error: error.message });
      } else {
        context.createdOfferIds = context.createdOfferIds.filter((id) => !toDelete.includes(id));
      }
    } catch (err: unknown) {
      cleanupErrors.push({
        entity: 'offers',
        ids: toDelete,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Limpieza de delivery_request_contacts
  if (context.createdContactRequestIds && context.createdContactRequestIds.length > 0) {
    const toDelete = [...context.createdContactRequestIds];
    try {
      const { error } = await admin.from('delivery_request_contacts').delete().in('request_id', toDelete);
      if (error) {
        cleanupErrors.push({ entity: 'delivery_request_contacts', ids: toDelete, error: error.message });
      } else {
        context.createdContactRequestIds = context.createdContactRequestIds.filter(
          (id) => !toDelete.includes(id)
        );
      }
    } catch (err: unknown) {
      cleanupErrors.push({
        entity: 'delivery_request_contacts',
        ids: toDelete,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Limpieza de delivery_requests
  const runRequestIds = [...context.createdRequestIds];
  if (context.createdRequestIds.length > 0) {
    const toDelete = [...context.createdRequestIds];
    try {
      const { error } = await admin.from('delivery_requests').delete().in('id', toDelete);
      if (error) {
        cleanupErrors.push({ entity: 'delivery_requests', ids: toDelete, error: error.message });
      } else {
        context.createdRequestIds = context.createdRequestIds.filter((id) => !toDelete.includes(id));
      }
    } catch (err: unknown) {
      cleanupErrors.push({
        entity: 'delivery_requests',
        ids: toDelete,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3a. Limpieza de rate_limits atribuibles a los usuarios de la corrida
  if (context.createdUserIds.length > 0) {
    const toDeleteUsers = [...context.createdUserIds];
    try {
      const rlBuilder = admin.from('rate_limits');
      if (typeof (rlBuilder as { delete?: unknown }).delete === 'function') {
        const { error: rlErr } = await rlBuilder.delete().in('subject', toDeleteUsers);
        if (rlErr) {
          cleanupErrors.push({ entity: 'rate_limits', ids: toDeleteUsers, error: rlErr.message });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('unexpected table')) {
        cleanupErrors.push({ entity: 'rate_limits', ids: toDeleteUsers, error: msg });
      }
    }
  }

  // 3b. Limpieza de audit_log atribuible a la corrida (antes de borrar profiles por ON DELETE SET NULL)
  if (context.createdUserIds.length > 0) {
    const toDeleteUsers = [...context.createdUserIds];
    try {
      const auditBuilder = admin.from('audit_log');
      if (typeof (auditBuilder as { delete?: unknown }).delete === 'function') {
        const { error: auditActorErr } = await auditBuilder.delete().in('actor_id', toDeleteUsers);
        if (auditActorErr) {
          cleanupErrors.push({ entity: 'audit_log.actor', ids: toDeleteUsers, error: auditActorErr.message });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('unexpected table')) {
        cleanupErrors.push({ entity: 'audit_log.actor', ids: toDeleteUsers, error: msg });
      }
    }
  }

  if (runRequestIds.length > 0) {
    try {
      const auditBuilder = admin.from('audit_log');
      const deleteResult =
        typeof (auditBuilder as { delete?: unknown }).delete === 'function'
          ? (auditBuilder as { delete: () => unknown }).delete()
          : null;
      if (deleteResult && typeof (deleteResult as { eq?: unknown }).eq === 'function') {
        const { error: auditReqErr } = await (
          deleteResult as {
            eq: (
              col: string,
              val: string
            ) => {
              in: (col2: string, vals: string[]) => Promise<{ error: { message: string } | null }>;
            };
          }
        )
          .eq('target_type', 'delivery_request')
          .in('target_id', runRequestIds);
        if (auditReqErr) {
          cleanupErrors.push({
            entity: 'audit_log.delivery_request',
            ids: runRequestIds,
            error: auditReqErr.message,
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('unexpected table')) {
        cleanupErrors.push({ entity: 'audit_log.delivery_request', ids: runRequestIds, error: msg });
      }
    }
  }

  // 4. Limpieza de couriers, merchants y profiles
  const failedUserIds = new Set<string>();
  if (context.createdUserIds.length > 0) {
    const toDeleteUsers = [...context.createdUserIds];

    try {
      const { error: courierErr } = await admin.from('couriers').delete().in('profile_id', toDeleteUsers);
      if (courierErr) {
        for (const uid of toDeleteUsers) failedUserIds.add(uid);
        cleanupErrors.push({ entity: 'couriers', ids: toDeleteUsers, error: courierErr.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('Unexpected table couriers')) {
        for (const uid of toDeleteUsers) failedUserIds.add(uid);
        cleanupErrors.push({ entity: 'couriers', ids: toDeleteUsers, error: msg });
      }
    }

    try {
      const { error: merchErr } = await admin.from('merchants').delete().in('profile_id', toDeleteUsers);
      if (merchErr) {
        for (const uid of toDeleteUsers) failedUserIds.add(uid);
        cleanupErrors.push({ entity: 'merchants', ids: toDeleteUsers, error: merchErr.message });
      }
    } catch (err: unknown) {
      for (const uid of toDeleteUsers) failedUserIds.add(uid);
      cleanupErrors.push({
        entity: 'merchants',
        ids: toDeleteUsers,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const { error: profErr } = await admin.from('profiles').delete().in('id', toDeleteUsers);
      if (profErr) {
        for (const uid of toDeleteUsers) failedUserIds.add(uid);
        cleanupErrors.push({ entity: 'profiles', ids: toDeleteUsers, error: profErr.message });
      }
    } catch (err: unknown) {
      for (const uid of toDeleteUsers) failedUserIds.add(uid);
      cleanupErrors.push({
        entity: 'profiles',
        ids: toDeleteUsers,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 5. Limpieza de zonas transitorias creadas por la prueba
  if (context.createdZoneIds.length > 0) {
    const toDeleteZones = [...context.createdZoneIds];
    try {
      const { error: zoneErr } = await admin.from('zones').delete().in('id', toDeleteZones);
      if (zoneErr) {
        cleanupErrors.push({ entity: 'zones', ids: toDeleteZones, error: zoneErr.message });
      } else {
        context.createdZoneIds = context.createdZoneIds.filter((id) => !toDeleteZones.includes(id));
      }
    } catch (err: unknown) {
      cleanupErrors.push({
        entity: 'zones',
        ids: toDeleteZones,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 6. Limpieza de usuarios auth
  if (context.createdUserIds.length > 0) {
    for (const userId of context.createdUserIds) {
      try {
        const { error: authErr } = await admin.auth.admin.deleteUser(userId);
        if (authErr) {
          failedUserIds.add(userId);
          cleanupErrors.push({ entity: 'auth.users', ids: [userId], error: authErr.message });
        }
      } catch (err: unknown) {
        failedUserIds.add(userId);
        cleanupErrors.push({
          entity: 'auth.users',
          ids: [userId],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // Conservar en el tracking todo usuario que haya fallado en cualquier etapa (couriers, merchants, profiles o auth.users)
    context.createdUserIds = context.createdUserIds.filter((id) => failedUserIds.has(id));
  }

  // 7. Si hubo fallos, reportar error agregado sin perder los IDs que fallaron
  if (cleanupErrors.length > 0) {
    const summary = cleanupErrors
      .map((e) => `${e.entity} [${e.ids.join(', ')}]: ${e.error}`)
      .join('; ');
    throw new Error(`[E2E Cleanup Error] Falló la limpieza de staging: ${summary}`);
  }
}

/**
 * Decodifica una clave base32 estándar a un buffer binario.
 */
export function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const clean = base32.toUpperCase().replace(/=+$/, '');
  const output = new Uint8Array(Math.floor((clean.length * 5) / 8));
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (!char) continue;
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error(`Carácter base32 inválido: ${char}`);
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return Buffer.from(output.buffer, output.byteOffset, index);
}

/**
 * Genera el código TOTP de 6 dígitos para un instante dado según RFC 6238 / RFC 4226.
 */
export function generateTotp(secret: string, timeMs = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timeMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const lastByte = hmac[hmac.length - 1];
  if (lastByte === undefined) throw new Error('HMAC digest vacío');
  const offset = lastByte & 0x0f;
  const b0 = hmac[offset] ?? 0;
  const b1 = hmac[offset + 1] ?? 0;
  const b2 = hmac[offset + 2] ?? 0;
  const b3 = hmac[offset + 3] ?? 0;
  const binary =
    ((b0 & 0x7f) << 24) |
    ((b1 & 0xff) << 16) |
    ((b2 & 0xff) << 8) |
    (b3 & 0xff);
  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Crea un cliente Supabase con credenciales públicas (anon key) sin sesión persistente.
 */
export function createE2EClient(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL || publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
): SupabaseClient<Database> {
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Autentica un usuario con sus credenciales efímeras en memoria y devuelve el cliente con sesión activa.
 */
export async function createAuthenticatedClient(
  credentials: UserCredentials,
  client?: SupabaseClient<Database>,
  env: Record<string, string | undefined> = process.env
): Promise<SupabaseClient<Database>> {
  assertAllowedE2EEnvironment(env);
  const targetClient =
    client ??
    createE2EClient(
      env.NEXT_PUBLIC_SUPABASE_URL || publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY || publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

  const { data, error } = await targetClient.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error || !data.user) {
    throw new Error(
      `[E2E Auth Error] Falló el inicio de sesión para ${credentials.email}: ${error?.message || 'Sin usuario retornado'}`
    );
  }

  return targetClient;
}

/**
 * Crea un usuario administrador en staging con credenciales efímeras en memoria.
 */
export async function seedAdminUser(
  context: StagingSeedContext,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<UserCredentials> {
  assertAllowedE2EEnvironment(env);
  const admin = client ?? createAdminClient();

  const adminEmail = `e2e_${context.testRunId}_admin@cadeapp-staging.test`;
  const adminPassword = `P@ssword_${randomUUID()}!`;
  const displayName = `E2E Admin ${context.testRunId}`;

  // H12: handle_new_user rechaza el rol 'admin' en signup público/admin.createUser (INVALID_SIGNUP_ROLE).
  // El bootstrap legítimo de admin crea el usuario con un rol permitido ('merchant'),
  // elimina el subtipo generado y promueve explícitamente profiles.role = 'admin' con service-role.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      role: 'merchant',
      display_name: displayName,
    },
  });

  if (authError || !authData?.user?.id) {
    throw new Error(
      `[E2E Seed Error] No se pudo crear usuario base para administrador: ${authError?.message || 'Sin usuario retornado'}`
    );
  }

  const adminUserId = authData.user.id;
  assertValidUuid(adminUserId, 'adminUserId');
  // Rastrear inmediatamente para garantizar cleanup incluso si los pasos siguientes fallan
  trackEntityForCleanup(context, 'user', adminUserId);

  // 1. Eliminar la fila temporal de merchants creada por el trigger handle_new_user
  const { error: merchDeleteErr } = await admin
    .from('merchants')
    .delete()
    .eq('profile_id', adminUserId);
  if (merchDeleteErr) {
    throw new Error(
      `[E2E Seed Error] Falló la eliminación del subtipo merchant temporal para admin: ${merchDeleteErr.message}`
    );
  }

  // 2. Promover el profile a admin y asegurar consent_status = 'active'
  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      role: 'admin',
      consent_status: 'active',
      display_name: displayName,
    })
    .eq('id', adminUserId);

  if (profileErr) {
    throw new Error(`[E2E Seed Error] Falló la promoción del profile a admin: ${profileErr.message}`);
  }

  // 3. Actualizar la metadata del auth user a admin
  const { error: updateMetaErr } = await admin.auth.admin.updateUserById(adminUserId, {
    user_metadata: {
      role: 'admin',
      display_name: displayName,
    },
  });
  if (updateMetaErr) {
    throw new Error(
      `[E2E Seed Error] Falló la actualización de metadata a admin: ${updateMetaErr.message}`
    );
  }

  const credentials: UserCredentials = {
    id: adminUserId,
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
    displayName,
  };

  context.adminUser = credentials;
  return credentials;
}

/**
 * Eleva la sesión del cliente administrador a AAL2 mediante enrolamiento y verificación TOTP.
 */
export async function elevateAdminToAal2(
  client: SupabaseClient<Database>,
  _credentials?: UserCredentials
): Promise<{ factorId: string }> {
  const { data: factors, error: listErr } = await client.auth.mfa.listFactors();
  if (listErr) {
    throw new Error(`[E2E MFA Error] Error al listar factores MFA: ${listErr.message}`);
  }

  // Limpiar factores sin verificar de intentos previos si los hubiera
  const unverified =
    factors?.all?.filter((f) => f.factor_type === 'totp' && f.status === 'unverified') ?? [];
  for (const factor of unverified) {
    await client.auth.mfa.unenroll({ factorId: factor.id });
  }

  // Enrolar nuevo factor TOTP
  const { data: enrolled, error: enrollErr } = await client.auth.mfa.enroll({
    factorType: 'totp',
  });
  if (enrollErr || !enrolled?.totp) {
    throw new Error(`[E2E MFA Error] Falló el enrolamiento MFA: ${enrollErr?.message}`);
  }

  const secret = enrolled.totp.secret;
  const code = generateTotp(secret);

  const { error: verifyErr } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code,
  });

  if (verifyErr) {
    throw new Error(`[E2E MFA Error] Falló verify MFA: ${verifyErr.message}`);
  }

  const { data: assurance } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== 'aal2') {
    throw new Error(
      `[E2E MFA Error] La sesión no alcanzó nivel aal2 (nivel actual: ${assurance?.currentLevel})`
    );
  }

  return { factorId: enrolled.id };
}

export interface SeedRequestInStateOptions {
  status: 'draft' | 'published' | 'matched' | 'in_transit' | 'delivered';
  merchantId?: string;
  pickupZoneId?: string;
  dropoffZoneId?: string;
  assignedCourierId?: string;
  expiresAt?: string;
  publishedAt?: string;
  matchedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  withContacts?: boolean;
  withPendingOffersCount?: number;
  withIncident?: {
    kind: 'no_show' | 'payment_issue' | 'damaged_goods' | 'safety' | 'other';
    description: string;
    reporterId: string;
  };
}

export interface SeedRequestInStateResult {
  requestId: string;
  acceptedOfferId: string | null;
  pendingOfferIds: string[];
  incidentId: string | null;
}

/**
 * Prepara las precondiciones de una solicitud en un estado específico usando el cliente service-role.
 * Solo prepara precondiciones iniciales; NUNCA ejecuta la transición bajo prueba.
 */
export async function seedDeliveryRequestInState(
  context: StagingSeedContext,
  options: SeedRequestInStateOptions,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<SeedRequestInStateResult> {
  assertAllowedE2EEnvironment(env);
  const admin = client ?? createAdminClient();

  const merchantId = options.merchantId ?? context.merchantUser?.id;
  if (!merchantId) {
    throw new Error('[E2E Seed Error] Se requiere un merchantId para seedDeliveryRequestInState');
  }
  assertValidUuid(merchantId, 'merchantId');

  let pickupZoneId = options.pickupZoneId;
  let dropoffZoneId = options.dropoffZoneId;

  if (!pickupZoneId || !dropoffZoneId) {
    const { data: existingZones } = await admin
      .from('zones')
      .select('id')
      .eq('active', true)
      .limit(2);
    pickupZoneId = existingZones?.[0]?.id ?? options.pickupZoneId;
    dropoffZoneId = existingZones?.[1]?.id ?? pickupZoneId;
    if (!pickupZoneId || !dropoffZoneId) {
      const newZoneId = randomUUID();
      await admin.from('zones').insert({
        id: newZoneId,
        name: `E2E Zona ${context.testRunId}`,
        centroid_lat: -27.43,
        centroid_lng: -65.61,
        active: true,
      });
      trackEntityForCleanup(context, 'zone', newZoneId);
      pickupZoneId = newZoneId;
      dropoffZoneId = newZoneId;
    }
  }

  assertValidUuid(pickupZoneId, 'pickupZoneId');
  assertValidUuid(dropoffZoneId, 'dropoffZoneId');

  const requestId = randomUUID();
  assertValidUuid(requestId, 'requestId');

  let acceptedOfferId: string | null = null;
  let courierId: string | null = null;
  const isPostMatched = ['matched', 'in_transit', 'delivered'].includes(options.status);

  if (isPostMatched) {
    courierId = options.assignedCourierId ?? context.courierUsers?.[0]?.id ?? null;
    if (!courierId) {
      throw new Error(
        '[E2E Seed Error] Se requiere assignedCourierId para solicitudes en estado matched/in_transit/delivered'
      );
    }
    assertValidUuid(courierId, 'assignedCourierId');

    acceptedOfferId = randomUUID();
    assertValidUuid(acceptedOfferId, 'acceptedOfferId');
  }

  const nowIso = new Date().toISOString();
  const publishedAt = options.publishedAt ?? (options.status !== 'draft' ? nowIso : null);
  const expiresAt =
    options.expiresAt ??
    (options.status === 'published' ? new Date(Date.now() + 45 * 60 * 1000).toISOString() : null);
  const matchedAt = options.matchedAt ?? (isPostMatched ? nowIso : null);
  const pickedUpAt =
    options.pickedUpAt ?? (['in_transit', 'delivered'].includes(options.status) ? nowIso : null);
  const deliveredAt = options.deliveredAt ?? (options.status === 'delivered' ? nowIso : null);

  // 1. Insertar delivery_request primero con accepted_offer_id = null para satisfacer FK offers.request_id -> delivery_requests.id
  const { error: reqErr } = await admin.from('delivery_requests').insert({
    id: requestId,
    merchant_id: merchantId,
    pickup_zone_id: pickupZoneId,
    dropoff_zone_id: dropoffZoneId,
    package_type: 'chico',
    recipient_payment_method: 'cash',
    status: options.status,
    published_at: publishedAt,
    expires_at: expiresAt,
    matched_at: matchedAt,
    picked_up_at: pickedUpAt,
    delivered_at: deliveredAt,
    accepted_offer_id: null,
    notes: `E2E state seed ${context.testRunId}`,
  });

  if (reqErr) {
    throw new Error(`[E2E Seed Error] Falló la inserción de delivery_request: ${reqErr.message}`);
  }
  trackEntityForCleanup(context, 'request', requestId);

  // 2. Si es post-match, insertar oferta aceptada referenciando el requestId ya persistido
  if (isPostMatched && acceptedOfferId && courierId) {
    const { error: offErr } = await admin.from('offers').insert({
      id: acceptedOfferId,
      request_id: requestId,
      courier_id: courierId,
      amount_ars: 2000,
      eta_minutes: 15,
      status: 'accepted',
      message: 'Oferta aceptada en seed',
    });
    if (offErr) {
      throw new Error(`[E2E Seed Error] Falló la creación de oferta aceptada: ${offErr.message}`);
    }
    trackEntityForCleanup(context, 'offer', acceptedOfferId);

    // 3. Vincular accepted_offer_id en delivery_requests
    const { error: linkErr } = await admin
      .from('delivery_requests')
      .update({ accepted_offer_id: acceptedOfferId })
      .eq('id', requestId);
    if (linkErr) {
      throw new Error(`[E2E Seed Error] Falló la vinculación de oferta aceptada: ${linkErr.message}`);
    }
  }

  if (options.withContacts) {
    const { error: contErr } = await admin.from('delivery_request_contacts').insert({
      request_id: requestId,
      pickup_address: 'Alberdi 150, Aguilares',
      pickup_lat: -27.432,
      pickup_lng: -65.612,
      dropoff_address: 'San Martín 400, Aguilares',
      dropoff_lat: -27.435,
      dropoff_lng: -65.615,
      recipient_name: 'Destinatario E2E',
      recipient_phone: '+5493865123456',
      recipient_consent_declared: true,
    });
    if (contErr) {
      throw new Error(`[E2E Seed Error] Falló la inserción de contactos: ${contErr.message}`);
    }
    trackEntityForCleanup(context, 'contact', requestId);
  }

  const pendingOfferIds: string[] = [];
  const pendingCount = options.withPendingOffersCount ?? 0;
  const couriers = context.courierUsers;
  if (pendingCount > 0 && couriers && couriers.length > 0) {
    for (let i = 0; i < pendingCount; i++) {
      const courier = couriers[i % couriers.length];
      if (!courier) continue;
      const pOfferId = randomUUID();
      const { error: pOffErr } = await admin.from('offers').insert({
        id: pOfferId,
        request_id: requestId,
        courier_id: courier.id,
        amount_ars: 1500 + i * 200,
        eta_minutes: 10 + i * 5,
        status: 'pending',
        message: `Oferta pendiente ${i + 1}`,
      });
      if (pOffErr) {
        throw new Error(
          `[E2E Seed Error] Falló la inserción de oferta pendiente ${i}: ${pOffErr.message}`
        );
      }
      trackEntityForCleanup(context, 'offer', pOfferId);
      pendingOfferIds.push(pOfferId);
    }
  }

  let incidentId: string | null = null;
  if (options.withIncident) {
    incidentId = randomUUID();
    const { error: incErr } = await admin.from('incidents').insert({
      id: incidentId,
      request_id: requestId,
      reporter_id: options.withIncident.reporterId,
      kind: options.withIncident.kind,
      description: options.withIncident.description,
      status: 'open',
    });
    if (incErr) {
      throw new Error(`[E2E Seed Error] Falló la creación de incidente: ${incErr.message}`);
    }
    trackEntityForCleanup(context, 'incident', incidentId);
  }

  return {
    requestId,
    acceptedOfferId,
    pendingOfferIds,
    incidentId,
  };
}

/**
 * Obtiene el valor numérico de una configuración de plataforma desde PostgreSQL.
 * Principio fail-closed: lanza excepción si la clave no existe, la consulta falla
 * o el valor no es un número finito válido (H13).
 */
export async function getPlatformSettingNumber(
  key: string,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<number> {
  assertAllowedE2EEnvironment(env);
  const admin = client ?? createAdminClient();
  const { data, error } = await admin
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    throw new Error(
      `[E2E Inspection Error] No se pudo leer la configuración '${key}': ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      `[E2E Inspection Error] No se pudo leer la configuración '${key}': fila no encontrada`
    );
  }

  const rawValue = (data as { value: unknown }).value;
  if (rawValue === null || rawValue === undefined) {
    throw new Error(
      `[E2E Inspection Error] No se pudo leer la configuración '${key}': el valor es nulo o indefinido`
    );
  }

  const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(num)) {
    throw new Error(
      `[E2E Inspection Error] No se pudo leer la configuración '${key}': el valor '${String(rawValue)}' no es un número finito`
    );
  }

  return num;
}

/**
 * Actualiza el estado de suscripción de un comercio para pruebas E2E de precondiciones.
 */
export async function setMerchantSubscriptionStatus(
  merchantId: string,
  status: 'pilot' | 'active' | 'expired' | 'cancelled',
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  assertAllowedE2EEnvironment(env);
  assertValidUuid(merchantId, 'merchantId');
  const admin = client ?? createAdminClient();
  const { error } = await admin
    .from('merchants')
    .update({ subscription_status: status })
    .eq('profile_id', merchantId);
  if (error) {
    throw new Error(`[E2E Seed Error] Error al actualizar suscripción de comercio: ${error.message}`);
  }
}

/**
 * [MUTATION PROOF H03] M1: Altera temporalmente el estado de una oferta hermana a 'pending' tras accept_offer.
 * Falla cerrado si el requestId no pertenece a la corrida E2E.
 */
export async function mutateForProofM1(
  context: StagingSeedContext,
  requestId: string,
  offerId: string,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  assertAllowedE2EEnvironment(env);
  if (!context.createdRequestIds.includes(requestId)) {
    throw new Error('[Mutation Proof Fail-Closed] Request ID no pertenece a la corrida E2E');
  }
  const admin = client ?? createAdminClient();
  const { error } = await admin
    .from('offers')
    .update({ status: 'pending' })
    .eq('id', offerId)
    .eq('request_id', requestId);
  if (error) {
    throw new Error(`[Mutation Proof Error M1] ${error.message}`);
  }
}

/**
 * [MUTATION PROOF H03] M2: Altera temporalmente expires_at de una solicitud para romper el cálculo del TTL.
 * Falla cerrado si el requestId no pertenece a la corrida E2E.
 */
export async function mutateForProofM2(
  context: StagingSeedContext,
  requestId: string,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  assertAllowedE2EEnvironment(env);
  if (!context.createdRequestIds.includes(requestId)) {
    throw new Error('[Mutation Proof Fail-Closed] Request ID no pertenece a la corrida E2E');
  }
  const admin = client ?? createAdminClient();
  const bogusExpiresAt = new Date(Date.now() + 1000 * 60 * 1000).toISOString();
  const { error } = await admin
    .from('delivery_requests')
    .update({ expires_at: bogusExpiresAt })
    .eq('id', requestId);
  if (error) {
    throw new Error(`[Mutation Proof Error M2] ${error.message}`);
  }
}

/**
 * [MUTATION PROOF H03] M3: Altera temporalmente el estado de una solicitud delivered a in_transit para romper el invariante del DoD.
 * Falla cerrado si el requestId no pertenece a la corrida E2E.
 */
export async function mutateForProofM3(
  context: StagingSeedContext,
  requestId: string,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  assertAllowedE2EEnvironment(env);
  if (!context.createdRequestIds.includes(requestId)) {
    throw new Error('[Mutation Proof Fail-Closed] Request ID no pertenece a la corrida E2E');
  }
  const admin = client ?? createAdminClient();
  const { error } = await admin
    .from('delivery_requests')
    .update({ status: 'in_transit' })
    .eq('id', requestId);
  if (error) {
    throw new Error(`[Mutation Proof Error M3] ${error.message}`);
  }
}

/**
 * [MUTATION PROOF H03] M4: Inserta temporalmente un incidente en una solicitud in_transit para romper el caso negativo de CC-015.
 * Falla cerrado si el requestId no pertenece a la corrida E2E.
 */
export async function mutateForProofM4(
  context: StagingSeedContext,
  requestId: string,
  reporterId: string,
  client?: AdminClientType,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  assertAllowedE2EEnvironment(env);
  if (!context.createdRequestIds.includes(requestId)) {
    throw new Error('[Mutation Proof Fail-Closed] Request ID no pertenece a la corrida E2E');
  }
  const admin = client ?? createAdminClient();
  const incidentId = randomUUID();
  const { error } = await admin.from('incidents').insert({
    id: incidentId,
    request_id: requestId,
    reporter_id: reporterId,
    kind: 'damaged_goods',
    description: '[MUTATION PROOF M4] Incidente temporal para forzar transicion exitosa',
    status: 'open',
  });
  if (error) {
    throw new Error(`[Mutation Proof Error M4] ${error.message}`);
  }
  trackEntityForCleanup(context, 'incident', incidentId);
}

