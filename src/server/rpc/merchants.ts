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

export type UpdateMyMerchantProfileResult = RpcOutput<'update_my_merchant_profile'>;

function mapUpdateMerchantProfileRpcError(
  error: SupabaseRpcErrorLike
): RpcErrorCode<'update_my_merchant_profile'> {
  const candidate = error.message.trim();
  const allowed: readonly string[] = RPC_CONTRACTS.update_my_merchant_profile.errorCodes;
  if (error.code === 'P0001' && allowed.includes(candidate)) {
    return candidate as RpcErrorCode<'update_my_merchant_profile'>;
  }
  if (error.code === '42501' || error.code === '28000') {
    return 'UNAUTHORIZED_ACTOR';
  }
  return 'INTERNAL_ERROR';
}

/**
 * CC-028: actualización transaccional y atómica del perfil de comercio autenticado.
 */
export async function updateMyMerchantProfileRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<
  ActionResult<UpdateMyMerchantProfileResult, RpcErrorCode<'update_my_merchant_profile'>>
> {
  const parsed = RPC_CONTRACTS.update_my_merchant_profile.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');

  try {
    const { data, error } = await client.rpc('update_my_merchant_profile', {
      p_patch: parsed.data,
    });
    if (error) return err(mapUpdateMerchantProfileRpcError(error));

    const output = RPC_CONTRACTS.update_my_merchant_profile.outputSchema.safeParse(data);
    if (!output.success) {
      return err('INTERNAL_ERROR');
    }

    return ok(output.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}
