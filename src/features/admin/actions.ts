'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/server/supabase/server';
import { createAdminClient } from '@/server/supabase/admin';
import { err, ok, type ActionResult, type DomainErrorCode } from '@/domain/errors';
import {
  adminDecideCourierRpc,
  adminSuspendCourierRpc,
  adminVerifyDocumentRpc,
} from '@/server/rpc/admin';
import type { ViewDocumentResult } from './types';
import { sanitizeAdminRedirect } from './redirect';

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
export async function verifyAdminMfaAction(input: {
  code: string;
  redirectTo?: string;
}): Promise<ActionResult<{ success: true; redirectTo: string }, DomainErrorCode>> {
  const cleanCode = input.code?.trim();
  if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
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
  if (factorsError || !factors?.totp?.length) {
    // Si no tiene TOTP configurado, error de configuración interna
    return err('INTERNAL_ERROR');
  }
  const factor = factors?.totp?.[0];
  if (!factor?.id) {
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
    code: cleanCode,
  });

  if (verifyError) {
    return err('VALIDATION_ERROR');
  }

  return ok({
    success: true,
    redirectTo: sanitizeAdminRedirect(input.redirectTo),
  });
}

/**
 * Genera una URL firmada de 60 segundos para visualizar un documento confidencial
 * del repartidor (DNI, selfie, licencia, seguro) y registra una fila inmutable en audit_log.
 */
export async function viewCourierDocumentAction(input: {
  documentId: string;
  courierId: string;
}): Promise<ActionResult<ViewDocumentResult, DomainErrorCode>> {
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
    .eq('id', input.documentId)
    .eq('courier_id', input.courierId)
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
    // Si falla el log de auditoría no se concede la visualización (seguridad innegociable)
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
export async function decideCourierAction(input: {
  courierId: string;
  decision: 'approved' | 'rejected';
  reason: string;
}): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  const trimmedReason = input.reason?.trim() ?? '';
  if (!trimmedReason) {
    return err('REASON_REQUIRED');
  }

  // PR106-H04: Invocar RPC usando cliente de sesión autenticada con AAL2, NUNCA createAdminClient
  const rpcResult = await adminDecideCourierRpc(authResult.data.supabase, {
    courierId: input.courierId,
    decision: input.decision,
    reason: trimmedReason,
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === 'AAL2_REQUIRED') return err('AAL2_REQUIRED');
    if (rpcResult.code === 'REASON_REQUIRED') return err('REASON_REQUIRED');
    if (rpcResult.code === 'UNAUTHORIZED_ACTOR') return err('UNAUTHORIZED_ACTOR');
    if (rpcResult.code === 'NOT_FOUND') return err('NOT_FOUND');
    return err('INTERNAL_ERROR');
  }

  revalidatePath('/admin/applicants');
  revalidatePath(`/admin/applicants/${input.courierId}`);
  return ok({ success: true });
}

/**
 * Suspende a un repartidor aprobado previamente.
 * El motivo de suspensión es obligatorio.
 */
export async function suspendCourierAction(input: {
  courierId: string;
  reason: string;
}): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  const trimmedReason = input.reason?.trim() ?? '';
  if (!trimmedReason) {
    return err('REASON_REQUIRED');
  }

  // PR106-H04: Invocar RPC usando cliente de sesión autenticada con AAL2, NUNCA createAdminClient
  const rpcResult = await adminSuspendCourierRpc(authResult.data.supabase, {
    courierId: input.courierId,
    reason: trimmedReason,
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === 'AAL2_REQUIRED') return err('AAL2_REQUIRED');
    if (rpcResult.code === 'REASON_REQUIRED') return err('REASON_REQUIRED');
    if (rpcResult.code === 'UNAUTHORIZED_ACTOR') return err('UNAUTHORIZED_ACTOR');
    if (rpcResult.code === 'NOT_FOUND') return err('NOT_FOUND');
    return err('INTERNAL_ERROR');
  }

  revalidatePath('/admin/applicants');
  revalidatePath(`/admin/applicants/${input.courierId}`);
  return ok({ success: true });
}

/**
 * Verifica o rechaza un documento individual del repartidor (licencia, seguro, etc.).
 */
export async function verifyCourierDocumentAction(input: {
  documentId: string;
  verified: boolean;
  rejectionReason?: string | null;
}): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  const authResult = await requireAdminAal2();
  if (!authResult.ok) {
    return authResult;
  }

  let reason: string | null = null;
  if (!input.verified) {
    const trimmedReason = input.rejectionReason?.trim() ?? '';
    if (!trimmedReason) {
      return err('REASON_REQUIRED');
    }
    reason = trimmedReason;
  }

  // PR106-H04: Invocar RPC usando cliente de sesión autenticada con AAL2
  // PR106-H05: Usar contrato canónico { documentId, decision: 'verified' | 'rejected', reason }
  const rpcResult = await adminVerifyDocumentRpc(authResult.data.supabase, {
    documentId: input.documentId,
    decision: input.verified ? 'verified' : 'rejected',
    reason,
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
