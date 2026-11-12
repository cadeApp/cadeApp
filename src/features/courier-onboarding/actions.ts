'use server';

import { createHmac } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/server/supabase/server';
import { createAdminClient } from '@/server/supabase/admin';
import { serverEnv } from '@/server/env';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import {
  addCourierOptionalDocumentInputSchema,
  replaceCourierDocumentInputSchema,
} from '@/domain/rpc-contracts';
import type { RpcOutput } from '@/domain/rpc-contracts';
import {
  addCourierOptionalDocumentRpc,
  courierVehicleRpc,
  replaceCourierDocumentRpc,
  type AddCourierOptionalDocumentResult,
  type CourierVehicleRpcName,
  type ReplaceCourierDocumentResult,
} from '@/server/rpc/courier';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import type { SupabaseRpcCaller } from '@/server/rpc/offers';
import { courierOnboardingSchema, courierUpdatePhoneSchema } from './schemas';
import { logoutAction } from '@/features/auth/server';
import { areCurrentLegalVersions } from '@/features/legal';

// CC-043: salida de `finalize_courier_application`; `submittedAt` es null en un histórico enviado sin fecha.
const finalizeCourierApplicationOutputSchema = z.object({
  ok: z.literal(true),
  idempotent: z.boolean(),
  submittedAt: z.string().nullable(),
});

/** CC-043: error de `finalize_courier_application` → código de la acción (actor o estado inválido → UNAUTHORIZED_ACTOR). */
function mapFinalizeCourierApplicationError(error: { code?: string; message?: string }): DomainErrorCode {
  const message = String(error.message ?? '').trim();
  if (error.code === 'P0001') {
    if (message === 'NOT_FOUND' || message === 'UNAUTHORIZED_ACTOR' || message === 'CONSENT_REQUIRED') {
      return 'UNAUTHORIZED_ACTOR';
    }
    if (
      message === 'VALIDATION_ERROR' ||
      message === 'DNI_ALREADY_REGISTERED' ||
      message === 'INVALID_STATE_TRANSITION'
    ) {
      return message;
    }
  }
  return 'INTERNAL_ERROR';
}

export async function logoutCourierAction() {
  return logoutAction();
}

export interface CourierOnboardingResult {
  readonly redirectTo: string;
}

function computeDniHmac(dni: string, secret: string): string {
  const normalizedDni = dni.replace(/\D/g, '');
  return createHmac('sha256', secret).update(normalizedDni).digest('hex');
}

export type DocumentValidationResult =
  | { status: 'MATCH' }
  | { status: 'DUPLICATE'; kind: string }
  | { status: 'MISSING'; kind: string }
  | { status: 'DIFFERENT_PATH'; kind: string; expected: string; actual: string }
  | { status: 'INVALID_STATUS'; kind: string; docStatus: string };

/**
 * Valida de forma pura el conjunto de documentos vigentes de un repartidor contra las entradas esperadas.
 * Recorre todas las filas is_current reales por courier:
 * - Si hay más de una de un kind -> DUPLICATE
 * - Si alguno de los kinds esperados tiene status distinto de 'submitted' / 'verified' -> INVALID_STATUS
 * - Si storage_path es distinto al esperado -> DIFFERENT_PATH
 * - Si faltan kinds requeridos -> MISSING
 * - Si todos coinciden exactamente -> MATCH
 */
export async function validateCurrentDocumentSet(
  expectedEntries: Array<{ kind: string; storage_path: string }>,
  docs: Array<{ id?: string; kind: string; storage_path: string; status: string; is_current?: boolean | null }>
): Promise<DocumentValidationResult> {
  const activeDocs = (docs ?? []).filter((d) => d.is_current !== false);
  const byKind = new Map<string, { id?: string; kind: string; storage_path: string; status: string; is_current?: boolean | null }>();

  for (const doc of activeDocs) {
    if (byKind.has(doc.kind)) {
      return { status: 'DUPLICATE', kind: doc.kind };
    }
    byKind.set(doc.kind, doc);
  }

  for (const expected of expectedEntries) {
    const existing = byKind.get(expected.kind);
    if (!existing) {
      return { status: 'MISSING', kind: expected.kind };
    }
    if (existing.status !== 'submitted' && existing.status !== 'verified') {
      return { status: 'INVALID_STATUS', kind: expected.kind, docStatus: existing.status };
    }
    if (existing.storage_path !== expected.storage_path) {
      return { status: 'DIFFERENT_PATH', kind: expected.kind, expected: expected.storage_path, actual: existing.storage_path };
    }
  }

  return { status: 'MATCH' };
}

export async function courierOnboardingAction(
  input: unknown
): Promise<ActionResult<CourierOnboardingResult, DomainErrorCode>> {
  // 1. Cliente autenticado y verificación de sesión
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  // 2. Verificación de rol del actor (debe ser courier)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'courier') {
    return err('UNAUTHORIZED_ACTOR');
  }

  // 3. Validación de datos de entrada
  const parsed = courierOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  if (
    !areCurrentLegalVersions([
      { document: 'tos', version: parsed.data.consents.tosVersion },
      { document: 'privacy', version: parsed.data.consents.privacyVersion },
      { document: 'courier_contract', version: parsed.data.consents.courierContractVersion },
    ])
  ) {
    return err('VALIDATION_ERROR');
  }

  // 4. Cálculo de dni_hmac con HMAC-SHA256 y secreto de servidor
  const hmacSecret = serverEnv.DNI_HMAC_SECRET;
  if (!hmacSecret) {
    return err('INTERNAL_ERROR');
  }
  const dniHmac = computeDniHmac(parsed.data.dni, hmacSecret);

  // 5. CC-050 (SEC-09, D2-A): sin consulta previa por dni_hmac (era un oráculo de DNI sin límite). El DNI ajeno lo frena
  // el unique en finalize (DNI_ALREADY_REGISTERED) y el propio rechazado o suspendido, finalize (UNAUTHORIZED_ACTOR).
  const adminClient = createAdminClient();

  // 7. Inserción de consentimientos en consents
  const consentsPayload: TablesInsert<'consents'>[] = [
    {
      profile_id: user.id,
      document: 'tos',
      version: parsed.data.consents.tosVersion,
    },
    {
      profile_id: user.id,
      document: 'privacy',
      version: parsed.data.consents.privacyVersion,
    },
    {
      profile_id: user.id,
      document: 'courier_contract',
      version: parsed.data.consents.courierContractVersion,
    },
  ];

  const { error: consentsError } = await adminClient
    .from('consents')
    .upsert(consentsPayload as never, {
      onConflict: 'profile_id,document,version',
      ignoreDuplicates: true,
    });

  if (consentsError) {
    return err('INTERNAL_ERROR');
  }

  // 8. Registro atómico de documentos en courier_documents mediante la RPC submit_courier_onboarding_documents
  // (Fase B de CC-025, PR #376).
  // La RPC se ejecuta bajo el cliente autenticado de sesión (auth.uid()), adquiere el lock transaccional
  // couriers(profile_id) FOR UPDATE, revalida consentimiento legal activo y rol courier, valida
  // exhaustivamente kinds, rutas y estados, y serializa de forma atómica reintentos limpios (idempotencia)
  // o rechaza colisiones con rutas distintas o documentos rechazados previos (H01/H02/H03).
  const documentEntries: Array<{ kind: string; storage_path: string }> = [
    {
      kind: 'dni_front',
      storage_path: parsed.data.documents.dni_front,
    },
    {
      kind: 'dni_back',
      storage_path: parsed.data.documents.dni_back,
    },
    {
      kind: 'selfie',
      storage_path: parsed.data.documents.selfie,
    },
    {
      kind: 'avatar',
      storage_path: parsed.data.documents.avatar,
    },
  ];

  if (parsed.data.documents.license) {
    documentEntries.push({
      kind: 'license',
      storage_path: parsed.data.documents.license,
    });
  }

  if (parsed.data.documents.insurance) {
    documentEntries.push({
      kind: 'insurance',
      storage_path: parsed.data.documents.insurance,
    });
  }

  // Validación defensiva en aplicación de rutas canónicas y tamaño (coincidente con los guards de la RPC)
  const expectedPrefix = `courier/${user.id}/`;
  for (const doc of documentEntries) {
    if (
      !doc.storage_path.startsWith(expectedPrefix) ||
      doc.storage_path.includes('..') ||
      doc.storage_path.length > 300
    ) {
      return err('VALIDATION_ERROR');
    }
  }

  const rpcClient: SupabaseRpcCaller = supabase;
  const { data: rpcData, error: rpcError } = await rpcClient.rpc(
    'submit_courier_onboarding_documents',
    { p_documents: documentEntries }
  );

  if (rpcError) {
    const errorMsg = String(rpcError.message ?? '');
    const errorDetails = String((rpcError as { details?: string }).details ?? '');
    const fullError = `${errorMsg} ${errorDetails}`;

    if (fullError.includes('UNAUTHENTICATED')) {
      return err('UNAUTHENTICATED');
    }
    if (
      fullError.includes('UNAUTHORIZED_ACTOR') ||
      fullError.includes('CONSENT_REQUIRED') ||
      fullError.includes('NOT_FOUND')
    ) {
      return err('UNAUTHORIZED_ACTOR');
    }
    if (fullError.includes('VALIDATION_ERROR')) {
      return err('VALIDATION_ERROR');
    }
    if (fullError.includes('INTERNAL_ERROR')) {
      return err('INTERNAL_ERROR');
    }
    return err('INTERNAL_ERROR');
  }

  const parsedRpcData =
    typeof rpcData === 'string'
      ? (() => {
          try {
            return JSON.parse(rpcData);
          } catch {
            return null;
          }
        })()
      : rpcData;

  if (!parsedRpcData || typeof parsedRpcData !== 'object' || !(parsedRpcData as { ok?: boolean }).ok) {
    return err('INTERNAL_ERROR');
  }

  // 5b. CC-050 (D1-A): cupo de 5 envíos por día. Va con la sesión (auth.uid()) y en otra transacción que finalize, así un
  // DNI_ALREADY_REGISTERED de finalize no revierte el contador.
  const { error: consumeError } = await rpcClient.rpc('consume_courier_application_attempt');
  if (consumeError) {
    const consumeMessage = String(consumeError.message ?? '').trim();
    return err(consumeError.code === 'P0001' && consumeMessage === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'INTERNAL_ERROR');
  }

  // 6. CC-043: el envío lo registra `finalize_courier_application` bajo el lock de couriers (DNI, vehículo, marca y
  // fecha del servidor). Va al final: si consentimientos o documentos fallan antes, la postulación sigue sin enviar
  // y el guard devuelve al repartidor al onboarding. Un reintento idéntico es idempotente.
  const finalizeArgs = {
    p_courier_id: user.id,
    p_dni_hmac: dniHmac,
    p_vehicle_type: parsed.data.vehicleType,
    p_vehicle_plate: parsed.data.vehiclePlate ? parsed.data.vehiclePlate.trim().toUpperCase() : null,
  };
  const { data: finalizeData, error: finalizeError } = await adminClient.rpc(
    'finalize_courier_application',
    // p_vehicle_plate es null para bici y a pie; los tipos generados no expresan argumentos nulos.
    finalizeArgs as never
  );

  if (finalizeError) {
    return err(mapFinalizeCourierApplicationError(finalizeError));
  }

  if (!finalizeCourierApplicationOutputSchema.safeParse(finalizeData).success) {
    return err('INTERNAL_ERROR');
  }

  // 9. Retorno ok con redirección a estado del onboarding
  return ok({
    redirectTo: '/onboarding/status',
  });
}

/**
 * CC-025 / T-356: Acción de servidor autenticada para reemplazar un documento rechazado del repartidor.
 * Invoca la RPC transaccional `replace_courier_document` con validación estricta de sesión, rol courier,
 * y prefijo canónico `courier/<user.id>/<kind>_`.
 */
export async function replaceCourierDocumentAction(
  input: unknown
): Promise<ActionResult<ReplaceCourierDocumentResult, DomainErrorCode>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'courier') {
    return err('UNAUTHORIZED_ACTOR');
  }

  const parsed = replaceCourierDocumentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const expectedPrefix = `courier/${user.id}/${parsed.data.kind}_`;
  if (
    !parsed.data.storagePath.startsWith(expectedPrefix) ||
    parsed.data.storagePath.includes('..') ||
    parsed.data.storagePath.length > 500
  ) {
    return err('VALIDATION_ERROR');
  }

  const rpcResult = await replaceCourierDocumentRpc(supabase, {
    kind: parsed.data.kind,
    storagePath: parsed.data.storagePath,
    ...(parsed.data.idempotencyKey ? { idempotencyKey: parsed.data.idempotencyKey } : {}),
    ...(parsed.data.vehicleId ? { vehicleId: parsed.data.vehicleId } : {}),
  });

  if (!rpcResult.ok) {
    return rpcResult;
  }

  revalidatePath('/courier/profile');
  revalidatePath('/courier/onboarding/status');

  return ok(rpcResult.data);
}

/**
 * T-376 / CC-033: alta posterior de la licencia o el seguro que no se cargaron en el onboarding. Exige sesión de
 * repartidor y el prefijo canónico `courier/<user.id>/<kind>_`; la RPC `add_courier_optional_document` (cliente de
 * sesión) vuelve a validar estado del repartidor, onboarding completo, documento vigente, Storage e idempotencia.
 */
export async function addCourierOptionalDocumentAction(
  input: unknown
): Promise<ActionResult<AddCourierOptionalDocumentResult, DomainErrorCode>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'courier') {
    return err('UNAUTHORIZED_ACTOR');
  }

  const parsed = addCourierOptionalDocumentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const expectedPrefix = `courier/${user.id}/${parsed.data.kind}_`;
  if (!parsed.data.storagePath.startsWith(expectedPrefix) || parsed.data.storagePath.includes('..')) {
    return err('VALIDATION_ERROR');
  }

  const rpcResult = await addCourierOptionalDocumentRpc(supabase, {
    kind: parsed.data.kind,
    storagePath: parsed.data.storagePath,
    ...(parsed.data.idempotencyKey ? { idempotencyKey: parsed.data.idempotencyKey } : {}),
    ...(parsed.data.vehicleId ? { vehicleId: parsed.data.vehicleId } : {}),
  });

  if (!rpcResult.ok) {
    return rpcResult;
  }

  revalidatePath('/courier/profile');
  revalidatePath('/courier/onboarding/vehicle');

  return ok(rpcResult.data);
}

/**
 * CC-042 / T-419: vehículos del repartidor. Las RPC validan actor, postulación enviada, bloqueo por ofertas o viaje y
 * patente; la acción exige la sesión y revalida las pantallas que muestran el vehículo activo.
 */
async function runCourierVehicleRpc<K extends CourierVehicleRpcName>(
  rpcName: K,
  input: unknown
): Promise<ActionResult<RpcOutput<K>, DomainErrorCode>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  const result = await courierVehicleRpc(supabase, rpcName, input);
  if (result.ok) {
    revalidatePath('/courier/profile');
    revalidatePath('/courier/feed');
    revalidatePath('/courier/onboarding/vehicle');
  }
  return result;
}

export async function addCourierVehicleAction(
  input: unknown
): Promise<ActionResult<RpcOutput<'add_courier_vehicle'>, DomainErrorCode>> {
  return runCourierVehicleRpc('add_courier_vehicle', input);
}

export async function updateCourierVehiclePlateAction(
  input: unknown
): Promise<ActionResult<RpcOutput<'update_courier_vehicle'>, DomainErrorCode>> {
  return runCourierVehicleRpc('update_courier_vehicle', input);
}

export async function removeCourierVehicleAction(
  input: unknown
): Promise<ActionResult<RpcOutput<'remove_courier_vehicle'>, DomainErrorCode>> {
  return runCourierVehicleRpc('remove_courier_vehicle', input);
}

export async function setActiveCourierVehicleAction(
  input: unknown
): Promise<ActionResult<RpcOutput<'set_active_courier_vehicle'>, DomainErrorCode>> {
  return runCourierVehicleRpc('set_active_courier_vehicle', input);
}

export interface CourierUpdatePhoneResult {
  readonly phone: string;
  readonly redirectTo?: string;
}

/**
 * T-355: Acción de servidor autenticada para actualizar exclusivamente el teléfono de contacto del repartidor.
 *
 * Invariantes y controles:
 * 1. Autenticación de sesión activa requerida (UNAUTHENTICATED).
 * 2. Actor verificado con rol 'courier' (UNAUTHORIZED_ACTOR).
 * 3. Allowlist estricta vía Zod `.strict()`: solo admite `{ phone: string }`. Rechaza cualquier campo extra
 *    (rol, email, dni, status, vehículo, etc.) con VALIDATION_ERROR.
 * 4. Normaliza el teléfono argentino a 10 dígitos nacionales.
 * 5. Muta únicamente la columna `phone` en la tabla `profiles` para el `user.id` de la sesión autenticada.
 * 6. Jamás registra teléfonos completos en logs ni mensajes de error (privacidad de datos de contacto).
 * 7. Revalida la ruta `/courier/profile` tras mutación exitosa.
 */
export async function updateCourierPhoneAction(
  input: unknown
): Promise<ActionResult<CourierUpdatePhoneResult, DomainErrorCode>> {
  // 1. Cliente autenticado y verificación de sesión
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  // 2. Verificación de rol del actor (debe ser courier)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'courier') {
    return err('UNAUTHORIZED_ACTOR');
  }

  // 3. Validación de datos de entrada (allowlist estricta)
  const parsed = courierUpdatePhoneSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  // 4. Actualización atómica del teléfono en profiles para el usuario autenticado
  const patch: TablesUpdate<'profiles'> = { phone: parsed.data.phone };
  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update(patch as never)
    .eq('id', user.id)
    .eq('role', 'courier')
    .select('id, phone')
    .maybeSingle<{ id: string; phone: string | null }>();

  if (updateError) {
    // Invariante de privacidad: mensaje fijo sin error.message, details, hint ni payload
    console.error('Error al actualizar teléfono de perfil en base de datos');
    return err('INTERNAL_ERROR');
  }

  if (!updatedProfile || updatedProfile.id !== user.id) {
    return err('NOT_FOUND');
  }

  revalidatePath('/courier/profile');

  return ok({
    phone: parsed.data.phone,
    redirectTo: '/courier/profile',
  });
}


