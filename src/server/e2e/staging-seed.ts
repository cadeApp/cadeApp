import 'server-only';
import { createAdminClient } from '@/server/supabase/admin';

export interface StagingSeedContext {
  testRunId: string;
  createdRequestIds: string[];
  createdOfferIds: string[];
  createdUserIds: string[];
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

/**
 * Evalúa si el entorno actual está explícitamente autorizado para operaciones E2E de staging/test.
 * Aplica política FAIL-CLOSED: si es producción, desconocido o ambiguo, prohíbe la ejecución.
 */
export function isAllowedE2EEnvironment(
  env: Record<string, string | undefined> = process.env
): EnvironmentCheckResult {
  // 1. Bloqueo estricto de producción
  if (env.VERCEL_ENV === 'production') {
    return { allowed: false, reason: 'VERCEL_ENV es production (bloqueado por seguridad)' };
  }
  if (env.APP_ENV === 'production') {
    return { allowed: false, reason: 'APP_ENV es production (bloqueado por seguridad)' };
  }
  if (env.NODE_ENV === 'production' && env.APP_ENV !== 'staging' && env.ALLOW_E2E_STAGING !== 'true') {
    return { allowed: false, reason: 'NODE_ENV es production sin confirmación explícita de staging' };
  }

  // 2. Verificación de URLs de producción
  const appUrl = (env.NEXT_PUBLIC_APP_URL || '').toLowerCase();
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').toLowerCase();

  const isProductionAppUrl =
    appUrl.includes('cadeapp.com') &&
    !appUrl.includes('staging.cadeapp.com') &&
    !appUrl.includes('cadeapp-staging');

  if (isProductionAppUrl) {
    return { allowed: false, reason: 'NEXT_PUBLIC_APP_URL apunta a dominio de producción' };
  }

  if (supabaseUrl.includes('cadeapp-prod')) {
    return { allowed: false, reason: 'NEXT_PUBLIC_SUPABASE_URL apunta al proyecto de producción' };
  }

  // 3. Confirmación afirmativa requerida (evita ambigüedad)
  const isStaging =
    env.APP_ENV === 'staging' ||
    env.VERCEL_ENV === 'preview' ||
    appUrl.includes('staging') ||
    supabaseUrl.includes('staging');

  const isTestOrCI =
    env.NODE_ENV === 'test' ||
    env.E2E_TEST === 'true' ||
    env.ALLOW_E2E_STAGING === 'true';

  const isLocalhost =
    appUrl.includes('localhost') ||
    appUrl.includes('127.0.0.1') ||
    supabaseUrl.includes('127.0.0.1');

  if (isStaging || isTestOrCI || isLocalhost) {
    return { allowed: true };
  }

  // Fail-closed por defecto ante configuración ausente o ambigua
  return {
    allowed: false,
    reason: 'Entorno ambiguo o no autorizado para E2E: falta indicador explícito de staging o test (fail-closed)',
  };
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
  };
}

/**
 * Registra entidades creadas durante la prueba para asegurar su limpieza posterior acotada.
 */
export function trackEntityForCleanup(
  context: StagingSeedContext,
  type: 'request' | 'offer' | 'user',
  id: string
): void {
  if (type === 'request') {
    if (!context.createdRequestIds.includes(id)) context.createdRequestIds.push(id);
  } else if (type === 'offer') {
    if (!context.createdOfferIds.includes(id)) context.createdOfferIds.push(id);
  } else if (type === 'user') {
    if (!context.createdUserIds.includes(id)) context.createdUserIds.push(id);
  }
}

type AdminClientType = ReturnType<typeof createAdminClient>;

/**
 * Crea datos transitorios mínimos en Supabase staging vinculados al testRunId.
 * Reutiliza createAdminClient() y jamás se expone en el cliente/navegador.
 */
export async function seedStagingData(
  context: StagingSeedContext,
  options?: SeedStagingOptions,
  client?: AdminClientType
): Promise<StagingSeedContext> {
  assertAllowedE2EEnvironment();

  const count = options?.requestsCount ?? 0;
  if (count <= 0) {
    return context;
  }

  const admin = client ?? createAdminClient();

  for (let i = 0; i < count; i++) {
    const requestId = `${context.testRunId}_req_${i + 1}`;
    try {
      const { data, error } = await admin
        .from('delivery_requests')
        .insert({
          id: requestId,
          merchant_id: options?.merchantId ?? `${context.testRunId}_merchant`,
          pickup_zone_id: options?.pickupZoneId ?? 'caba_norte',
          dropoff_zone_id: options?.dropoffZoneId ?? 'caba_sur',
          package_type: 'chico',
          recipient_payment_method: 'cash',
          status: 'published',
          notes: `E2E automated test run ${context.testRunId}`,
        })
        .select('id')
        .single();

      if (!error && data?.id) {
        trackEntityForCleanup(context, 'request', data.id);
      } else {
        // Fallback al ID generado para garantizar seguimiento
        trackEntityForCleanup(context, 'request', requestId);
      }
    } catch {
      // Tolera error en inserción individual y sigue rastreando para garantizar cleanup
      trackEntityForCleanup(context, 'request', requestId);
    }
  }

  return context;
}

/**
 * Limpia exclusivamente los registros creados por esta ejecución E2E.
 * Respeta el orden relacional inverso (offers -> requests -> users) y tolera fallos parciales.
 */
export async function cleanupStagingData(
  context: StagingSeedContext | string[],
  client?: AdminClientType
): Promise<void> {
  assertAllowedE2EEnvironment();

  if (Array.isArray(context)) {
    // Si se pasa una lista directa de IDs de requests
    if (context.length === 0) return;
    const admin = client ?? createAdminClient();
    try {
      await admin.from('delivery_requests').delete().in('id', context);
    } catch {
      // Tolerar fallo parcial sin bloquear la suite
    }
    return;
  }

  const admin = client ?? createAdminClient();

  // 1. Limpieza de ofertas creadas por esta corrida
  if (context.createdOfferIds.length > 0) {
    try {
      await admin.from('offers').delete().in('id', [...context.createdOfferIds]);
    } catch {
      // Tolerar fallo
    }
  }

  // 2. Limpieza de delivery_requests creados por esta corrida
  if (context.createdRequestIds.length > 0) {
    try {
      await admin.from('delivery_requests').delete().in('id', [...context.createdRequestIds]);
    } catch {
      // Tolerar fallo
    }
  }

  // 3. Limpieza de usuarios auth de prueba
  if (context.createdUserIds.length > 0) {
    for (const userId of context.createdUserIds) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // Tolerar fallo en borrado de usuario individual
      }
    }
  }

  // Vaciar listas tras limpieza
  context.createdOfferIds.length = 0;
  context.createdRequestIds.length = 0;
  context.createdUserIds.length = 0;
}
