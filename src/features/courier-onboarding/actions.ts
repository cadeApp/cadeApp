'use server';

import { createHmac } from 'node:crypto';
import { createClient } from '@/server/supabase/server';
import { createAdminClient } from '@/server/supabase/admin';
import { serverEnv } from '@/server/env';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
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

  // 6. Persistencia de dni_hmac y vehículo en couriers via adminClient
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

  const { error: consentsError } = await supabase.from('consents').insert(consentsPayload as never);

  if (consentsError) {
    return err('INTERNAL_ERROR');
  }

  // 8. Inserción de documentos en courier_documents
  const documentEntries: TablesInsert<'courier_documents'>[] = [
    {
      courier_id: user.id,
      kind: 'dni_front',
      storage_path: parsed.data.documents.dni_front,
      status: 'submitted',
    },
    {
      courier_id: user.id,
      kind: 'dni_back',
      storage_path: parsed.data.documents.dni_back,
      status: 'submitted',
    },
    {
      courier_id: user.id,
      kind: 'selfie',
      storage_path: parsed.data.documents.selfie,
      status: 'submitted',
    },
    {
      courier_id: user.id,
      kind: 'avatar',
      storage_path: parsed.data.documents.avatar,
      status: 'submitted',
    },
  ];

  if (parsed.data.documents.license) {
    documentEntries.push({
      courier_id: user.id,
      kind: 'license',
      storage_path: parsed.data.documents.license,
      status: 'submitted',
    });
  }

  if (parsed.data.documents.insurance) {
    documentEntries.push({
      courier_id: user.id,
      kind: 'insurance',
      storage_path: parsed.data.documents.insurance,
      status: 'submitted',
    });
  }

  const { error: documentsError } = await supabase
    .from('courier_documents')
    .upsert(documentEntries as never);

  if (documentsError) {
    return err('INTERNAL_ERROR');
  }

  // 9. Retorno ok con redirección a estado del onboarding
  return ok({
    redirectTo: '/onboarding/status',
  });
}
