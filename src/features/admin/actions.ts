'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/server/supabase/server';
import { createAdminClient } from '@/server/supabase/admin';
import { err, ok, type ActionResult, type DomainErrorCode } from '@/domain/errors';
import {
  adminDecideCourierRpc,
  adminGrantPublicationCreditsRpc,
  adminListPublicationPlansRpc,
  adminRegisterPlanPeriodRpc,
  adminReinstateCourierRpc,
  adminUpsertPublicationPlanRpc,
  adminSetSubscriptionRpc,
  adminSuspendCourierRpc,
  adminUpdateSettingRpc,
  adminVerifyDocumentRpc,
} from '@/server/rpc/admin';
import type { ViewDocumentResult } from './types';
import { sanitizeAdminRedirect } from './redirect';
import {
  adminMfaSchema,
  viewCourierDocumentSchema,
  decideCourierSchema,
  suspendCourierSchema,
  reinstateCourierSchema,
  verifyCourierDocumentSchema,
  type AdminMfaInput,
  type ViewCourierDocumentInput,
  type DecideCourierInput,
  type SuspendCourierInput,
  type ReinstateCourierInput,
  type VerifyCourierDocumentInput,
  setMerchantSubscriptionSchema,
  updatePlatformSettingSchema,
  type SetMerchantSubscriptionInput,
  type UpdatePlatformSettingInput,
  grantPublicationCreditsSchema,
  registerPlanPeriodSchema,
  upsertPublicationPlanSchema,
} from './schemas';
import { RPC_CONTRACTS, platformSettingKeySchema, type RpcOutput } from '@/domain';

interface AuthenticatedAdmin {
  readonly id: string;
  readonly email: string;
  readonly supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Valida estrictamente que el actor esté autenticado, tenga rol 'admin' y posea el claim MFA 'aal2'.
 * Cumple con el DoD de T-122 y los invariantes de seguridad de la plataforma.
 */
async function requireAdminAal2(): Promise<ActionResult<AuthenticatedAdmin, DomainErrorCode>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  // 1. Verificación de rol 'admin' en perfiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (profileError || !profile || profile.role !== 'admin') {
    return err('UNAUTHORIZED_ACTOR');
  }

  // 2. Verificación de nivel de autenticación AAL2 (MFA TOTP)
  const { data: aalData, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError || aalData?.currentLevel !== 'aal2') {
    return err('AAL2_REQUIRED');
  }

  return ok({
    id: user.id,
    email: user.email ?? '',
    supabase,
  });
}

/**
 * Verifica el código TOTP ingresado por el administrador para elevar su sesión a AAL2.
 */
export async function verifyAdminMfaAction(
  input: AdminMfaInput
): Promise<ActionResult<{ success: true; redirectTo: string }, DomainErrorCode>> {
  const parsed = adminMfaSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

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
    .maybeSingle<{ role: string }>();

  if (profileError || !profile || profile.role !== 'admin') {
    return err('UNAUTHORIZED_ACTOR');
  }

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || !factors) {
    return err('INTERNAL_ERROR');
  }
  // `totp` solo trae factores verificados: un `mfa.enroll()` sin verificar no cuenta. Sin factor activo no
  // hay segundo paso posible, y la pantalla lo explica en vez de mostrar una falla genérica.
  const factor = factors.totp?.[0];
  if (!factor) {
    return err('AAL2_REQUIRED');
  }
  if (!factor.id) {
    return err('INTERNAL_ERROR');
  }

  const factorId = factor.id;
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError || !challenge) {
    return err('INTERNAL_ERROR');
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: parsed.data.code,
  });

  if (verifyError) {
    return err('VALIDATION_ERROR');
  }

  return ok({
    success: true,
    redirectTo: sanitizeAdminRedirect(parsed.data.redirectTo),
  });
}

/**
 * Genera una URL firmada de 60 segundos para visualizar un documento confidencial
 * del repartidor (DNI, selfie, licencia, seguro) y registra una fila inmutable en audit_log.
 */
export async function viewCourierDocumentAction(
  input: ViewCourierDocumentInput
): Promise<ActionResult<ViewDocumentResult, DomainErrorCode>> {
  const parsed = viewCourierDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }
  const adminUser = authResult.data;

  const adminClient = createAdminClient();

  // Obtener metadata del documento
  const { data: doc, error: docError } = await adminClient
    .from('courier_documents')
    .select('id, courier_id, kind, storage_path')
    .eq('id', parsed.data.documentId)
    .eq('courier_id', parsed.data.courierId)
    .maybeSingle();

  if (docError || !doc) {
    return err('NOT_FOUND');
  }

  // Generación de URL firmada con vencimiento estricto de 60 segundos
  const { data: signedData, error: signedError } = await adminClient.storage
    .from('courier-docs')
    .createSignedUrl(doc.storage_path, 60);

  if (signedError || !signedData?.signedUrl) {
    return err('INTERNAL_ERROR');
  }

  // Registro inmutable de auditoría
  const { error: auditError } = await adminClient.from('audit_log').insert({
    actor_id: adminUser.id,
    action: 'view_courier_document',
    target_type: 'courier_document',
    target_id: doc.id,
    after: {
      courier_id: doc.courier_id,
      document_id: doc.id,
      kind: doc.kind,
      expires_in_seconds: 60,
    },
  });

  if (auditError) {
    return err('INTERNAL_ERROR');
  }

  return ok({
    signedUrl: signedData.signedUrl,
    expiresInSeconds: 60,
  });
}

/**
 * Aprueba o rechaza la postulación de un repartidor.
 * El motivo es obligatorio para garantizar trazabilidad.
 */
export async function decideCourierAction(
  input: DecideCourierInput
): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  const parsed = decideCourierSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  // PR106-H04: Invocar RPC usando cliente de sesión autenticada con AAL2, NUNCA createAdminClient
  const rpcResult = await adminDecideCourierRpc(authResult.data.supabase, {
    courierId: parsed.data.courierId,
    decision: parsed.data.decision,
    reason: parsed.data.reason,
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === 'AAL2_REQUIRED') return err('AAL2_REQUIRED');
    if (rpcResult.code === 'REASON_REQUIRED') return err('REASON_REQUIRED');
    if (rpcResult.code === 'UNAUTHORIZED_ACTOR') return err('UNAUTHORIZED_ACTOR');
    if (rpcResult.code === 'NOT_FOUND') return err('NOT_FOUND');
    if (rpcResult.code === 'INVALID_STATE_TRANSITION') return err('INVALID_STATE_TRANSITION');
    return err('INTERNAL_ERROR');
  }

  revalidatePath('/admin/applicants');
  revalidatePath(`/admin/applicants/${parsed.data.courierId}`);
  return ok({ success: true });
}

/**
 * CC-034: reactiva a un repartidor suspendido o reconsidera uno rechazado (vuelve a `approved` sin disponibilidad).
 * El motivo es obligatorio. `idempotent: true` (ya estaba aprobado: doble clic o reintento) es éxito.
 */
export async function reinstateCourierAction(
  input: ReinstateCourierInput
): Promise<ActionResult<{ success: true; idempotent: boolean }, DomainErrorCode>> {
  const parsed = reinstateCourierSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  // Cliente de sesión con AAL2, nunca createAdminClient: la RPC vuelve a exigir admin con MFA.
  const rpcResult = await adminReinstateCourierRpc(authResult.data.supabase, {
    courierId: parsed.data.courierId,
    reason: parsed.data.reason,
  });

  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath('/admin/applicants');
  revalidatePath(`/admin/applicants/${parsed.data.courierId}`);
  return ok({ success: true, idempotent: rpcResult.data.idempotent });
}

/**
 * Suspende a un repartidor aprobado previamente.
 * El motivo de suspensión es obligatorio.
 */
export async function suspendCourierAction(
  input: SuspendCourierInput
): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  const parsed = suspendCourierSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  // PR106-H04: Invocar RPC usando cliente de sesión autenticada con AAL2, NUNCA createAdminClient
  const rpcResult = await adminSuspendCourierRpc(authResult.data.supabase, {
    courierId: parsed.data.courierId,
    reason: parsed.data.reason,
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === 'AAL2_REQUIRED') return err('AAL2_REQUIRED');
    if (rpcResult.code === 'REASON_REQUIRED') return err('REASON_REQUIRED');
    if (rpcResult.code === 'UNAUTHORIZED_ACTOR') return err('UNAUTHORIZED_ACTOR');
    if (rpcResult.code === 'NOT_FOUND') return err('NOT_FOUND');
    return err('INTERNAL_ERROR');
  }

  revalidatePath('/admin/applicants');
  revalidatePath(`/admin/applicants/${parsed.data.courierId}`);
  return ok({ success: true });
}

/**
 * Verifica o rechaza un documento individual del repartidor (licencia, seguro, etc.).
 */
export async function verifyCourierDocumentAction(
  input: VerifyCourierDocumentInput
): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  const parsed = verifyCourierDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  // PR106-H04: Invocar RPC usando cliente de sesión autenticada con AAL2
  // PR106-H05: Usar contrato canónico { documentId, decision: 'verified' | 'rejected', reason }
  const rpcResult = await adminVerifyDocumentRpc(authResult.data.supabase, {
    documentId: parsed.data.documentId,
    decision: parsed.data.verified ? 'verified' : 'rejected',
    reason: parsed.data.verified ? null : parsed.data.rejectionReason ?? null,
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === 'AAL2_REQUIRED') return err('AAL2_REQUIRED');
    if (rpcResult.code === 'REASON_REQUIRED') return err('REASON_REQUIRED');
    if (rpcResult.code === 'UNAUTHORIZED_ACTOR') return err('UNAUTHORIZED_ACTOR');
    if (rpcResult.code === 'NOT_FOUND') return err('NOT_FOUND');
    return err('INTERNAL_ERROR');
  }

  revalidatePath('/admin/applicants');
  return ok({ success: true });
}

/**
 * A03: cambia el plan de un comercio (piloto, pago manual, `paid_until`) vía `admin_set_subscription`.
 */
export async function setMerchantSubscriptionAction(
  input: SetMerchantSubscriptionInput
): Promise<ActionResult<RpcOutput<'admin_set_subscription'>, DomainErrorCode>> {
  const parsed = setMerchantSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  // La RPC valida aal2 otra vez y registra before/after en audit_log; la action nunca escribe tablas.
  const rpcResult = await adminSetSubscriptionRpc(authResult.data.supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath('/admin/merchants');
  revalidatePath('/admin/audit');
  return ok(rpcResult.data);
}

/**
 * A04: actualiza un parámetro de `platform_settings` vía `admin_update_setting`.
 */
export async function updatePlatformSettingAction(
  input: UpdatePlatformSettingInput
): Promise<ActionResult<RpcOutput<'admin_update_setting'>, DomainErrorCode>> {
  const parsed = updatePlatformSettingSchema.safeParse(input);
  if (!parsed.success) {
    const candidateKey: unknown =
      typeof input === 'object' && input !== null && 'key' in input ? input.key : undefined;
    const isKnownKey = platformSettingKeySchema.safeParse(candidateKey).success;
    return err(isKnownKey ? 'INVALID_SETTING_VALUE' : 'INVALID_SETTING_KEY');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  // La RPC valida aal2 otra vez y registra before/after en audit_log; la action nunca escribe tablas.
  const rpcResult = await adminUpdateSettingRpc(authResult.data.supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath('/admin/settings');
  revalidatePath('/admin/audit');
  return ok(rpcResult.data);
}

/**
 * CC-029: acredita créditos sueltos de una compra confirmada fuera de la app o de un ajuste. La app no procesa pagos.
 * El cliente manda una `operationKey` estable por operación: reintentar la misma no duplica la acreditación.
 */
export async function grantPublicationCreditsAction(
  input: unknown
): Promise<ActionResult<RpcOutput<'admin_grant_publication_credits'>, DomainErrorCode>> {
  const parsed = grantPublicationCreditsSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  const rpcResult = await adminGrantPublicationCreditsRpc(authResult.data.supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath(`/admin/merchants/${parsed.data.merchantId}/credits`);
  revalidatePath('/admin/audit');
  return ok(rpcResult.data);
}

/** CC-029: registra el primer período o la renovación de un plan; idempotente por `operationKey`. */
export async function registerPlanPeriodAction(
  input: unknown
): Promise<ActionResult<RpcOutput<'admin_register_plan_period'>, DomainErrorCode>> {
  const parsed = registerPlanPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  const rpcResult = await adminRegisterPlanPeriodRpc(authResult.data.supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath(`/admin/merchants/${parsed.data.merchantId}/credits`);
  revalidatePath('/admin/audit');
  return ok(rpcResult.data);
}

/** CC-029: crea o edita un plan del catálogo (`PLAN_IN_USE` si se cambia el cupo de uno con períodos). */
export async function upsertPublicationPlanAction(
  input: unknown
): Promise<ActionResult<RpcOutput<'admin_upsert_publication_plan'>, DomainErrorCode>> {
  const parsed = upsertPublicationPlanSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  const rpcResult = await adminUpsertPublicationPlanRpc(authResult.data.supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath('/admin/merchants/plans');
  revalidatePath('/admin/audit');
  return ok(rpcResult.data);
}

/**
 * CC-029 addendum D01-B: página siguiente del catálogo para el diálogo de registro de plan (PR402-H03). Valida el
 * cursor, exige admin con AAL2 y llama a `admin_list_publication_plans` con la sesión, que vuelve a verificarlo.
 */
export async function listPublicationPlansAction(
  input: unknown
): Promise<ActionResult<RpcOutput<'admin_list_publication_plans'>, DomainErrorCode>> {
  const parsed = RPC_CONTRACTS.admin_list_publication_plans.inputSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  const rpcResult = await adminListPublicationPlansRpc(authResult.data.supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }
  return ok(rpcResult.data);
}
