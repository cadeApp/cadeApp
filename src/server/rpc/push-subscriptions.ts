import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcErrorCode,
  type RpcOutput,
} from '@/domain';
import type { SupabaseRpcCaller, SupabaseRpcErrorLike } from './offers';

function mapRegisterPushSubscriptionError(
  error: SupabaseRpcErrorLike
): RpcErrorCode<'register_push_subscription'> {
  const candidate = error.message.trim();
  const allowed: readonly string[] = RPC_CONTRACTS.register_push_subscription.errorCodes;
  if (error.code === 'P0001' && allowed.includes(candidate)) {
    return candidate as RpcErrorCode<'register_push_subscription'>;
  }
  if (error.code === '42501' || error.code === '28000') {
    return 'UNAUTHORIZED_ACTOR';
  }
  return 'INTERNAL_ERROR';
}

/**
 * CC-035: registra la suscripción push del navegador para la cuenta logueada (cliente de sesión). Si el endpoint era
 * de otra cuenta, la RPC lo reasigna; la salida nunca dice de quién era.
 */
export async function registerPushSubscriptionRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<
  ActionResult<RpcOutput<'register_push_subscription'>, RpcErrorCode<'register_push_subscription'>>
> {
  const parsed = RPC_CONTRACTS.register_push_subscription.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');

  try {
    const { data, error } = await client.rpc('register_push_subscription', {
      p_payload: {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        platform: parsed.data.platform ?? null,
      },
    });
    if (error) return err(mapRegisterPushSubscriptionError(error));

    const output = RPC_CONTRACTS.register_push_subscription.outputSchema.safeParse(data);
    if (!output.success) return err('INTERNAL_ERROR');
    return ok(output.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}
