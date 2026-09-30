import 'server-only';
import { createAdminClient } from '@/server/supabase/admin';

export interface StagingSeedContext {
  testRunId: string;
  createdRequestIds: string[];
  createdOfferIds: string[];
  createdUserIds: string[];
  createdZoneIds: string[];
}

export interface SeedStagingOptions {
  requestsCount?: number;
  merchantId?: string;
  pickupZoneId?: string;
  dropoffZoneId?: string;
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
      KNOWN_STAGING_PROJECT_REFS.includes(targetProjectRef!) ||
      (PLACEHOLDER_TEST_PROJECT_REFS.includes(targetProjectRef!) && env.NODE_ENV === 'test'));

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
  };
}

/**
 * Registra entidades creadas durante la prueba para asegurar su limpieza posterior acotada.
 * Exige estrictamente que el ID sea un UUID válido.
 */
export function trackEntityForCleanup(
  context: StagingSeedContext,
  type: 'request' | 'offer' | 'user' | 'zone',
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
  }
}

type AdminClientType = ReturnType<typeof createAdminClient>;

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
  if (count <= 0) {
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
      .select('id')
      .eq('active', true)
      .limit(2);

    if (zonesQueryError) {
      throw new Error(`[E2E Seed Error] Error al consultar zonas: ${zonesQueryError.message}`);
    }

    const firstZone = existingZones?.[0];
    if (firstZone) {
      pickupZoneId = firstZone.id;
      dropoffZoneId = existingZones[1]?.id ?? firstZone.id;
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
  } else {
    const merchantEmail = `e2e_${context.testRunId}_merchant@cadeapp-staging.test`;
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: merchantEmail,
      password: `P@ssword_${crypto.randomUUID()}!`,
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

    // Asegurar filas en profiles y merchants (resiliente ante entornos sin trigger de auth)
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: createdUserId,
      role: 'merchant',
      display_name: `E2E Merchant ${context.testRunId}`,
      phone: '+5491112345678',
    });
    if (profileErr) {
      throw new Error(`[E2E Seed Error] Falló el upsert en profiles: ${profileErr.message}`);
    }

    const { error: merchantErr } = await admin.from('merchants').upsert({
      profile_id: createdUserId,
      business_name: `E2E Comercio ${context.testRunId}`,
    });
    if (merchantErr) {
      throw new Error(`[E2E Seed Error] Falló el upsert en merchants: ${merchantErr.message}`);
    }

    merchantId = createdUserId;
  }

  assertValidUuid(merchantId, 'merchantId');

  // 3. Crear solicitudes de envío reales con UUIDs válidos
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
    // Solo se registra tras confirmación positiva de Supabase
    trackEntityForCleanup(context, 'request', data.id);
  }

  return context;
}

/**
 * Limpia exclusivamente los registros creados por esta ejecución E2E.
 * Respeta el orden relacional inverso:
 * 1. offers
 * 2. delivery_requests
 * 3. merchants
 * 4. profiles
 * 5. zones creadas por la corrida
 * 6. auth users
 * Tolera fallos parciales sin bloquear la suite completa.
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
    } catch (err: any) {
      throw new Error(`[E2E Cleanup Error] Falló la limpieza directa: ${err?.message || String(err)}`);
    }
    return;
  }

  const admin = client ?? createAdminClient();
  const cleanupErrors: Array<{ entity: string; ids: string[]; error: string }> = [];

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
    } catch (err: any) {
      cleanupErrors.push({ entity: 'offers', ids: toDelete, error: err?.message || String(err) });
    }
  }

  // 2. Limpieza de delivery_requests
  if (context.createdRequestIds.length > 0) {
    const toDelete = [...context.createdRequestIds];
    try {
      const { error } = await admin.from('delivery_requests').delete().in('id', toDelete);
      if (error) {
        cleanupErrors.push({ entity: 'delivery_requests', ids: toDelete, error: error.message });
      } else {
        context.createdRequestIds = context.createdRequestIds.filter((id) => !toDelete.includes(id));
      }
    } catch (err: any) {
      cleanupErrors.push({ entity: 'delivery_requests', ids: toDelete, error: err?.message || String(err) });
    }
  }

  // 3. Limpieza de merchants y profiles
  const failedUserIds = new Set<string>();
  if (context.createdUserIds.length > 0) {
    const toDeleteUsers = [...context.createdUserIds];
    try {
      const { error: merchErr } = await admin.from('merchants').delete().in('profile_id', toDeleteUsers);
      if (merchErr) {
        for (const uid of toDeleteUsers) failedUserIds.add(uid);
        cleanupErrors.push({ entity: 'merchants', ids: toDeleteUsers, error: merchErr.message });
      }
    } catch (err: any) {
      for (const uid of toDeleteUsers) failedUserIds.add(uid);
      cleanupErrors.push({ entity: 'merchants', ids: toDeleteUsers, error: err?.message || String(err) });
    }

    try {
      const { error: profErr } = await admin.from('profiles').delete().in('id', toDeleteUsers);
      if (profErr) {
        for (const uid of toDeleteUsers) failedUserIds.add(uid);
        cleanupErrors.push({ entity: 'profiles', ids: toDeleteUsers, error: profErr.message });
      }
    } catch (err: any) {
      for (const uid of toDeleteUsers) failedUserIds.add(uid);
      cleanupErrors.push({ entity: 'profiles', ids: toDeleteUsers, error: err?.message || String(err) });
    }
  }

  // 4. Limpieza de zonas transitorias creadas por la prueba
  if (context.createdZoneIds.length > 0) {
    const toDeleteZones = [...context.createdZoneIds];
    try {
      const { error: zoneErr } = await admin.from('zones').delete().in('id', toDeleteZones);
      if (zoneErr) {
        cleanupErrors.push({ entity: 'zones', ids: toDeleteZones, error: zoneErr.message });
      } else {
        context.createdZoneIds = context.createdZoneIds.filter((id) => !toDeleteZones.includes(id));
      }
    } catch (err: any) {
      cleanupErrors.push({ entity: 'zones', ids: toDeleteZones, error: err?.message || String(err) });
    }
  }

  // 5. Limpieza de usuarios auth
  if (context.createdUserIds.length > 0) {
    for (const userId of context.createdUserIds) {
      try {
        const { error: authErr } = await admin.auth.admin.deleteUser(userId);
        if (authErr) {
          failedUserIds.add(userId);
          cleanupErrors.push({ entity: 'auth.users', ids: [userId], error: authErr.message });
        }
      } catch (err: any) {
        failedUserIds.add(userId);
        cleanupErrors.push({ entity: 'auth.users', ids: [userId], error: err?.message || String(err) });
      }
    }
    // Conservar en el tracking todo usuario que haya fallado en cualquier etapa (merchants, profiles o auth.users)
    context.createdUserIds = context.createdUserIds.filter((id) => failedUserIds.has(id));
  }

  // 6. Si hubo fallos, reportar error agregado sin perder los IDs que fallaron
  if (cleanupErrors.length > 0) {
    const summary = cleanupErrors
      .map((e) => `${e.entity} [${e.ids.join(', ')}]: ${e.error}`)
      .join('; ');
    throw new Error(`[E2E Cleanup Error] Falló la limpieza de staging: ${summary}`);
  }
}
