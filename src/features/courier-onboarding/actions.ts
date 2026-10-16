'use server';

import { createHmac } from 'node:crypto';
import { createClient } from '@/server/supabase/server';
import { createAdminClient } from '@/server/supabase/admin';
import { serverEnv } from '@/server/env';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import type { SupabaseRpcCaller } from '@/server/rpc/offers';
import { courierOnboardingSchema } from './schemas';
import { logoutAction } from '@/features/auth/server';
import { areCurrentLegalVersions } from '@/features/legal';

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

  // 5. Chequeo en couriers via createAdminClient bloqueando si ya existe con status rejected o suspended
  const adminClient = createAdminClient();

  const { data: existingCourier, error: checkError } = await adminClient
    .from('couriers')
    .select('profile_id, status')
    .eq('dni_hmac', dniHmac)
    .maybeSingle<{ profile_id: string; status: string }>();

  if (checkError) {
    return err('INTERNAL_ERROR');
  }

  if (existingCourier) {
    if (
      existingCourier.status === 'rejected' ||
      existingCourier.status === 'suspended' ||
      existingCourier.profile_id !== user.id
    ) {
      return err('DNI_ALREADY_REGISTERED');
    }
  }

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

  // 6. Persistencia de dni_hmac y vehículo en couriers via adminClient.
  // T-334 / D01: va al final porque vehicle_type marca el onboarding como enviado; si consentimientos o
  // documentos fallan antes, el courier queda con vehicle_type null y el guard lo devuelve al onboarding.
  const courierUpdatePayload: TablesUpdate<'couriers'> = {
    dni_hmac: dniHmac,
    vehicle_type: parsed.data.vehicleType,
    vehicle_plate: parsed.data.vehiclePlate ? parsed.data.vehiclePlate.trim().toUpperCase() : null,
  };

  const { error: courierUpdateError } = await adminClient
    .from('couriers')
    .update(courierUpdatePayload as never)
    .eq('profile_id', user.id);

  if (courierUpdateError) {
    return err('INTERNAL_ERROR');
  }

  // 9. Retorno ok con redirección a estado del onboarding
  return ok({
    redirectTo: '/onboarding/status',
  });
}
