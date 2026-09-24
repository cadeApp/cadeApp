import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcErrorCode,
  type RpcOutput,
} from '@/domain';

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
  | 'admin_verify_document'
  | 'admin_set_subscription'
  | 'admin_update_setting';

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

  const { documentId, decision, reason } = parsedInput.data;
  const { data, error } = await client.rpc('admin_verify_document', {
    p_document_id: documentId,
    p_decision: decision,
    p_reason: reason ?? null,
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

const VALID_SETTING_KEYS = new Set([
  'min_offer_ars',
  'request_ttl_minutes',
  'pilot_active',
  'pilot_terms_version',
  'subscription_grace_days',
]);

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
    // H09: Alinear error de parseo con INVALID_SETTING_KEY o INVALID_SETTING_VALUE igual que en el fake
    if (
      typeof rawInput === 'object' &&
      rawInput !== null &&
      'key' in rawInput &&
      typeof (rawInput as { key: unknown }).key === 'string'
    ) {
      const candidateKey = (rawInput as { key: string }).key;
      if (!VALID_SETTING_KEYS.has(candidateKey)) {
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
