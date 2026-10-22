import 'server-only';

import {
  PLATFORM_SETTING_KEYS,
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcErrorCode,
  type RpcOutput,
} from '@/domain';
import { createAdminClient } from '@/server/supabase/admin';

export interface SupabaseRpcErrorLike {
  readonly code?: string;
  readonly message: string;
  readonly details?: string | null;
  readonly hint?: string | null;
}

export interface SupabaseRpcResponse<T = unknown> {
  readonly data: T | null;
  readonly error: SupabaseRpcErrorLike | null;
}

export interface SupabaseRpcCaller {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<SupabaseRpcResponse<unknown>>;
}

type AdminRpcName =
  | 'admin_decide_courier'
  | 'admin_suspend_courier'
  | 'admin_reinstate_courier'
  | 'admin_verify_document'
  | 'admin_set_subscription'
  | 'admin_update_setting'
  | 'admin_resolve_incident'
  | 'admin_list_incidents'
  | PublicationCreditsRpcName;

/** CC-029 (T-369): RPC admin de créditos de publicación y planes. */
type PublicationCreditsRpcName =
  | 'admin_upsert_publication_plan'
  | 'admin_grant_publication_credits'
  | 'admin_register_plan_period'
  | 'admin_get_merchant_publication_credits'
  | 'admin_list_publication_plans';

function isAllowedAdminRpcError<K extends AdminRpcName>(
  rpcName: K,
  candidate: string,
): candidate is RpcErrorCode<K> {
  const allowedCodes: readonly string[] = RPC_CONTRACTS[rpcName].errorCodes;
  return allowedCodes.includes(candidate as RpcErrorCode<K>);
}

/**
 * Maps PostgREST / Postgres errors returned by admin RPC functions into strict `RpcErrorCode<K> | 'INTERNAL_ERROR'`.
 * Unrecognized infrastructure/database errors fall back to `INTERNAL_ERROR`.
 */
export function mapAdminRpcError<K extends AdminRpcName>(
  rpcName: K,
  error: SupabaseRpcErrorLike,
): RpcErrorCode<K> | 'INTERNAL_ERROR' {
  const trimmedMessage = error.message.trim();

  if (isAllowedAdminRpcError(rpcName, trimmedMessage)) {
    return trimmedMessage;
  }

  for (const allowedCode of RPC_CONTRACTS[rpcName].errorCodes) {
    if (trimmedMessage.includes(allowedCode)) {
      return allowedCode as RpcErrorCode<K>;
    }
  }

  if (
    (error.code === '42501' || error.code === '28000') &&
    isAllowedAdminRpcError(rpcName, 'UNAUTHORIZED_ACTOR')
  ) {
    return 'UNAUTHORIZED_ACTOR';
  }

  return 'INTERNAL_ERROR';
}

/**
 * Typed server wrapper for `public.admin_decide_courier(p_courier_id, p_decision, p_reason)`.
 */
export async function adminDecideCourierRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'admin_decide_courier'>,
    RpcErrorCode<'admin_decide_courier'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.admin_decide_courier.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { courierId, decision, reason } = parsedInput.data;
  const { data, error } = await client.rpc('admin_decide_courier', {
    p_courier_id: courierId,
    p_decision: decision,
    p_reason: reason ?? null,
  });

  if (error) {
    return err(mapAdminRpcError('admin_decide_courier', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.admin_decide_courier.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  // T-206: Si el repartidor fue rechazado/deshabilitado, purgar sus suscripciones
  if (parsedOutput.data.status === 'rejected') {
    try {
      const admin = createAdminClient();
      await admin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', parsedOutput.data.courierId);
    } catch {
      // Best effort: fallo en la purga no altera la decisión administrativa
    }
  }

  return ok(parsedOutput.data);
}

/**
 * Typed server wrapper for `public.admin_reinstate_courier(p_courier_id, p_reason)` (CC-034): reactiva un repartidor
 * suspendido o reconsidera uno rechazado. Sobre uno ya aprobado devuelve `idempotent: true`.
 */
export async function adminReinstateCourierRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'admin_reinstate_courier'>,
    RpcErrorCode<'admin_reinstate_courier'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.admin_reinstate_courier.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { courierId, reason } = parsedInput.data;
  const { data, error } = await client.rpc('admin_reinstate_courier', {
    p_courier_id: courierId,
    p_reason: reason,
  });

  if (error) {
    return err(mapAdminRpcError('admin_reinstate_courier', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.admin_reinstate_courier.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

/**
 * Typed server wrapper for `public.admin_suspend_courier(p_courier_id, p_reason)`.
 */
export async function adminSuspendCourierRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'admin_suspend_courier'>,
    RpcErrorCode<'admin_suspend_courier'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.admin_suspend_courier.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { courierId, reason } = parsedInput.data;
  const { data, error } = await client.rpc('admin_suspend_courier', {
    p_courier_id: courierId,
    p_reason: reason,
  });

  if (error) {
    return err(mapAdminRpcError('admin_suspend_courier', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.admin_suspend_courier.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  // T-206: Purgar suscripciones del repartidor suspendido tras el éxito de la RPC
  try {
    const admin = createAdminClient();
    await admin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', parsedOutput.data.courierId);
  } catch {
    // Best effort: fallo en la purga no altera la suspensión administrativa
  }

  return ok(parsedOutput.data);
}

/**
 * Typed server wrapper for `public.admin_verify_document(p_document_id, p_decision, p_reason)`.
 */
export async function adminVerifyDocumentRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'admin_verify_document'>,
    RpcErrorCode<'admin_verify_document'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.admin_verify_document.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { documentId, decision, reason, rejectionCode } = parsedInput.data;
  const { data, error } = await client.rpc('admin_verify_document', {
    p_document_id: documentId,
    p_decision: decision,
    p_reason: reason ?? null,
    p_rejection_code: rejectionCode ?? null,
  });

  if (error) {
    return err(mapAdminRpcError('admin_verify_document', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.admin_verify_document.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

/**
 * Typed server wrapper for `public.admin_set_subscription(p_merchant_id, p_subscription_status, p_paid_until, p_notes)`.
 */
export async function adminSetSubscriptionRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'admin_set_subscription'>,
    RpcErrorCode<'admin_set_subscription'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.admin_set_subscription.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { merchantId, subscriptionStatus, paidUntil, notes } = parsedInput.data;
  const { data, error } = await client.rpc('admin_set_subscription', {
    p_merchant_id: merchantId,
    p_subscription_status: subscriptionStatus,
    p_paid_until: paidUntil ?? null,
    p_notes: notes ?? null,
  });

  if (error) {
    return err(mapAdminRpcError('admin_set_subscription', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.admin_set_subscription.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

/**
 * Typed server wrapper for `public.admin_update_setting(p_key, p_value)`.
 */
export async function adminUpdateSettingRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'admin_update_setting'>,
    RpcErrorCode<'admin_update_setting'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.admin_update_setting.inputSchema.safeParse(rawInput);

  if (!parsedInput.success) {
    // H09 & H16: Alinear error de parseo con INVALID_SETTING_KEY o INVALID_SETTING_VALUE utilizando PLATFORM_SETTING_KEYS
    if (
      typeof rawInput === 'object' &&
      rawInput !== null &&
      'key' in rawInput &&
      typeof (rawInput as { key: unknown }).key === 'string'
    ) {
      const candidateKey = (rawInput as { key: string }).key;
      const isKnownKey = (PLATFORM_SETTING_KEYS as readonly string[]).includes(
        candidateKey,
      );
      if (!isKnownKey) {
        return err('INVALID_SETTING_KEY');
      }
      return err('INVALID_SETTING_VALUE');
    }
    return err('VALIDATION_ERROR');
  }

  const { key, value } = parsedInput.data;
  // H06: Pasar p_value tal cual (sin JSON.stringify redundante)
  const { data, error } = await client.rpc('admin_update_setting', {
    p_key: key,
    p_value: value,
  });

  if (error) {
    return err(mapAdminRpcError('admin_update_setting', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.admin_update_setting.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

/**
 * CC-012: typed server wrapper for `public.admin_resolve_incident(p_incident_id, p_decision, p_reason)`.
 * The courier affected by `preventive_suspension` is derived inside Postgres; it is never an input.
 */
export async function adminResolveIncidentRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'admin_resolve_incident'>,
    RpcErrorCode<'admin_resolve_incident'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.admin_resolve_incident.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { incidentId, decision, reason } = parsedInput.data;
  const { data, error } = await client.rpc('admin_resolve_incident', {
    p_incident_id: incidentId,
    p_decision: decision,
    p_reason: reason,
  });

  if (error) {
    return err(mapAdminRpcError('admin_resolve_incident', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.admin_resolve_incident.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  // T-206: Si la resolución implica suspensión preventiva del repartidor, purgar sus suscripciones
  if (
    parsedOutput.data.decision === 'preventive_suspension' &&
    parsedOutput.data.courierId
  ) {
    try {
      const admin = createAdminClient();
      await admin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', parsedOutput.data.courierId);
    } catch {
      // Best effort: fallo en la purga no altera la resolución del incidente
    }
  }

  return ok(parsedOutput.data);
}

/**
 * CC-012: typed server wrapper for
 * `public.admin_list_incidents(p_statuses, p_cursor_created_at, p_cursor_id, p_limit)`.
 * Keyset pagination (created_at DESC, id DESC) lives in Postgres.
 */
export async function adminListIncidentsRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'admin_list_incidents'>,
    RpcErrorCode<'admin_list_incidents'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.admin_list_incidents.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { statuses, cursor, limit } = parsedInput.data;
  const { data, error } = await client.rpc('admin_list_incidents', {
    p_statuses: statuses,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit ?? null,
  });

  if (error) {
    return err(mapAdminRpcError('admin_list_incidents', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.admin_list_incidents.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

type AdminRpcResult<K extends AdminRpcName> = ActionResult<RpcOutput<K>, RpcErrorCode<K> | 'INTERNAL_ERROR'>;

/** Ejecuta una RPC admin de créditos ya validada: mapea el error al contrato y valida la salida. */
async function callPublicationCreditsRpc<K extends PublicationCreditsRpcName>(
  client: SupabaseRpcCaller,
  rpcName: K,
  args: Record<string, unknown>,
): Promise<AdminRpcResult<K>> {
  const { data, error } = await client.rpc(rpcName, args);
  if (error) {
    return err(mapAdminRpcError(rpcName, error));
  }
  const parsedOutput = RPC_CONTRACTS[rpcName].outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }
  return ok(parsedOutput.data as RpcOutput<K>);
}

/**
 * CC-029: `public.admin_upsert_publication_plan(...)`. Crea o edita el catálogo; `kind` y el cupo no cambian si el plan
 * ya tiene períodos (`PLAN_IN_USE`). CC-038: `p_code` va nulo; la base genera el código y no lo cambia al editar.
 */
export async function adminUpsertPublicationPlanRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<AdminRpcResult<'admin_upsert_publication_plan'>> {
  const parsed = RPC_CONTRACTS.admin_upsert_publication_plan.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');
  const input = parsed.data;
  return callPublicationCreditsRpc(client, 'admin_upsert_publication_plan', {
    p_plan_id: input.planId,
    p_code: null,
    p_name: input.name,
    p_kind: input.kind,
    p_monthly_credits: input.monthlyCredits,
    p_reference_price_ars: input.referencePriceArs,
    p_active: input.active,
    p_sort: input.sort,
  });
}

/**
 * CC-029: `public.admin_grant_publication_credits(...)`. Registra créditos sueltos de una compra confirmada fuera de la
 * app o de un ajuste. `operationKey` hace idempotente el reintento de la misma operación.
 */
export async function adminGrantPublicationCreditsRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<AdminRpcResult<'admin_grant_publication_credits'>> {
  const parsed = RPC_CONTRACTS.admin_grant_publication_credits.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');
  const input = parsed.data;
  return callPublicationCreditsRpc(client, 'admin_grant_publication_credits', {
    p_merchant_id: input.merchantId,
    p_credits: input.credits,
    p_source: input.source,
    p_operation_key: input.operationKey,
    p_note: input.note ?? null,
  });
}

/** CC-029: `public.admin_register_plan_period(...)`. Alta o renovación de un período de plan, idempotente por clave. */
export async function adminRegisterPlanPeriodRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<AdminRpcResult<'admin_register_plan_period'>> {
  const parsed = RPC_CONTRACTS.admin_register_plan_period.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');
  const input = parsed.data;
  return callPublicationCreditsRpc(client, 'admin_register_plan_period', {
    p_merchant_id: input.merchantId,
    p_plan_id: input.planId,
    p_is_purchase: input.isPurchase,
    p_operation_key: input.operationKey,
    p_note: input.note ?? null,
  });
}

/** CC-029: `public.admin_get_merchant_publication_credits(...)`. Saldo y libro paginado (máximo 50, cursor por id). */
export async function adminGetMerchantPublicationCreditsRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<AdminRpcResult<'admin_get_merchant_publication_credits'>> {
  const parsed = RPC_CONTRACTS.admin_get_merchant_publication_credits.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');
  const input = parsed.data;
  return callPublicationCreditsRpc(client, 'admin_get_merchant_publication_credits', {
    p_merchant_id: input.merchantId,
    p_limit: input.limit ?? 50,
    p_before_id: input.beforeId ?? null,
  });
}

/**
 * CC-029 addendum D01-B: `public.admin_list_publication_plans(...)`. Catálogo para el admin AAL2 (lo verifica la RPC),
 * de a 50 como máximo, ordenado por (sort, id) y con cursor de la última fila. Siempre con el cliente de sesión.
 */
export async function adminListPublicationPlansRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<AdminRpcResult<'admin_list_publication_plans'>> {
  const parsed = RPC_CONTRACTS.admin_list_publication_plans.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');
  const input = parsed.data;
  return callPublicationCreditsRpc(client, 'admin_list_publication_plans', {
    p_limit: input.limit ?? 50,
    p_after_sort: input.afterSort ?? null,
    p_after_id: input.afterId ?? null,
    p_active_only: input.activeOnly ?? false,
  });
}
