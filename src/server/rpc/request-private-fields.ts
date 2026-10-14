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

export type MerchantRequestPrivateFields = RpcOutput<'get_merchant_request_private_fields'>;

function mapPrivateFieldsRpcError(
  error: SupabaseRpcErrorLike
): RpcErrorCode<'get_merchant_request_private_fields'> {
  const candidate = error.message.trim();
  const allowed: readonly string[] = RPC_CONTRACTS.get_merchant_request_private_fields.errorCodes;
  if (error.code === 'P0001' && allowed.includes(candidate)) {
    return candidate as RpcErrorCode<'get_merchant_request_private_fields'>;
  }
  if (error.code === '42501' || error.code === '28000') {
    return 'UNAUTHORIZED_ACTOR';
  }
  return 'INTERNAL_ERROR';
}

/**
 * CC-023: indicaciones y monto exacto de cambio de una solicitud propia, para el comercio dueño.
 * Con CC-023 `notes` y `cash_change_amount` no se leen por tabla; esta RPC es la única frontera.
 */
export async function getMerchantRequestPrivateFieldsRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<
  ActionResult<MerchantRequestPrivateFields, RpcErrorCode<'get_merchant_request_private_fields'>>
> {
  const parsed = RPC_CONTRACTS.get_merchant_request_private_fields.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');

  try {
    const { data, error } = await client.rpc('get_merchant_request_private_fields', {
      p_request_id: parsed.data.requestId,
    });
    if (error) return err(mapPrivateFieldsRpcError(error));

    const output = RPC_CONTRACTS.get_merchant_request_private_fields.outputSchema.safeParse(data);
    if (!output.success || output.data.requestId !== parsed.data.requestId) {
      return err('INTERNAL_ERROR');
    }

    return ok(output.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}
