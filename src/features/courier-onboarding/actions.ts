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

  // 8. Inserción de documentos en courier_documents con idempotencia ante reintentos (PR364-H05 / PR364-R01)
  // Se usa cliente de sesión autenticado e INSERT autorizado (el permiso UPDATE está revocado para authenticated).
  const { data: existingDocs, error: checkDocsError } = await supabase
    .from('courier_documents')
    .select('id, kind, storage_path, status, is_current')
    .eq('courier_id', user.id);

  if (checkDocsError) {
    return err('INTERNAL_ERROR');
  }

  // En base expandida previa a Fase C pueden coexistir duplicados históricos con is_current=true.
  // No aceptar selección arbitraria en Map: si hay duplicados del mismo kind, rechazar con fallo seguro (INTERNAL_ERROR).
  const existingByKind = new Map<string, { id?: string; kind: string; storage_path: string; status: string; is_current?: boolean | null }>();
  const activeExistingDocs = ((existingDocs as Array<{ id?: string; kind: string; storage_path: string; status: string; is_current?: boolean | null }>) ?? [])
    .filter((d) => d.is_current !== false);

  for (const doc of activeExistingDocs) {
    if (existingByKind.has(doc.kind)) {
      return err('INTERNAL_ERROR');
    }
    existingByKind.set(doc.kind, doc);
  }

  const documentEntriesToInsert: typeof documentEntries = [];
  for (const entry of documentEntries) {
    const existing = existingByKind.get(entry.kind);
    if (!existing) {
      documentEntriesToInsert.push(entry);
    } else if (existing.storage_path !== entry.storage_path) {
      return err('VALIDATION_ERROR');
    }
  }

  if (documentEntriesToInsert.length > 0) {
    const { error: documentsError } = await supabase
      .from('courier_documents')
      .insert(documentEntriesToInsert as never);

    if (documentsError) {
      const errObj = documentsError as { code?: string; message?: string; details?: string };
      const isUniqueConflict =
        errObj.code === '23505' ||
        String(errObj.message ?? '').includes('23505') ||
        String(errObj.message ?? '').toLowerCase().includes('unique') ||
        String(errObj.details ?? '').toLowerCase().includes('already exists');

      const isRlsConflict =
        errObj.code === '42501' ||
        String(errObj.message ?? '').includes('42501') ||
        String(errObj.message ?? '').toLowerCase().includes('row-level security') ||
        String(errObj.message ?? '').toLowerCase().includes('permission denied');

      if (isUniqueConflict || isRlsConflict) {
        // En carrera concurrente (dos envíos simultáneos), volver a validar actor y consentimientos
        const { data: recheckedProfile, error: profileRecheckError } = await supabase
          .from('profiles')
          .select('id, role, consent_status')
          .eq('id', user.id)
          .maybeSingle<{ id: string; role: string; consent_status?: string }>();

        if (
          profileRecheckError ||
          !recheckedProfile ||
          recheckedProfile.role !== 'courier' ||
          (recheckedProfile.consent_status !== undefined && recheckedProfile.consent_status !== 'active')
        ) {
          return err('UNAUTHORIZED_ACTOR');
        }

        // Releer todas las versiones vigentes del courier
        const { data: recheckedDocs, error: recheckError } = await supabase
          .from('courier_documents')
          .select('id, kind, storage_path, status, is_current')
          .eq('courier_id', user.id);

        if (recheckError) {
          return err('INTERNAL_ERROR');
        }

        const recheckedByKind = new Map<string, { id?: string; kind: string; storage_path: string; status: string; is_current?: boolean | null }>();
        const activeRecheckedDocs = ((recheckedDocs as Array<{ id?: string; kind: string; storage_path: string; status: string; is_current?: boolean | null }>) ?? [])
          .filter((d) => d.is_current !== false);

        for (const doc of activeRecheckedDocs) {
          if (recheckedByKind.has(doc.kind)) {
            return err('INTERNAL_ERROR');
          }
          recheckedByKind.set(doc.kind, doc);
        }

        for (const entry of documentEntries) {
          const rechecked = recheckedByKind.get(entry.kind);
          if (
            !rechecked ||
            rechecked.storage_path !== entry.storage_path ||
            (rechecked.status !== 'submitted' && rechecked.status !== 'verified')
          ) {
            return err('VALIDATION_ERROR');
          }
        }
      } else {
        return err('INTERNAL_ERROR');
      }
    } else {
      // Post-verificación defensiva para Fase B (donde aún no rige el índice único de Fase C):
      // Si dos peticiones simultáneas hicieron INSERT sin error, verificar si se generaron
      // duplicados vigentes del mismo kind. Si se detectan duplicados (count > 1), abortar de
      // forma segura con INTERNAL_ERROR sin actualizar el perfil ni marcar el onboarding como completo.
      const { data: postDocs, error: postDocsError } = await supabase
        .from('courier_documents')
        .select('id, kind, storage_path, status, is_current')
        .eq('courier_id', user.id);

      if (postDocsError) {
        return err('INTERNAL_ERROR');
      }

      const postActiveDocs = ((postDocs as Array<{ id?: string; kind: string; storage_path: string; status: string; is_current?: boolean | null }>) ?? [])
        .filter((d) => d.is_current !== false);

      const activeCountByKind = new Map<string, number>();
      for (const doc of postActiveDocs) {
        const currentCount = (activeCountByKind.get(doc.kind) ?? 0) + 1;
        if (currentCount > 1) {
          return err('INTERNAL_ERROR');
        }
        activeCountByKind.set(doc.kind, currentCount);
      }
    }
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
