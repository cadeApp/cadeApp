import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RequestCancellationHistory,
  type RpcErrorCode,
} from '@/domain';
import { createClient } from '@/server/supabase/server';
import type { SupabaseRpcCaller, SupabaseRpcErrorLike } from './offers';

type HistoryErrorCode = RpcErrorCode<'get_request_cancellation_history'>;

function mapHistoryRpcError(error: SupabaseRpcErrorLike): HistoryErrorCode {
  const candidate = error.message.trim();
  const allowed: readonly string[] = RPC_CONTRACTS.get_request_cancellation_history.errorCodes;
  if (error.code === 'P0001' && allowed.includes(candidate)) {
    return candidate as HistoryErrorCode;
  }
  if (error.code === '42501' || error.code === '28000') {
    return 'UNAUTHORIZED_ACTOR';
  }
  return 'INTERNAL_ERROR';
}

/**
 * CC-032: cancelaciones de asignación del repartidor (`courier_cancel_match`) de un pedido. La autorización por
 * actor, el filtro de eventos propios del repartidor y el ocultamiento del texto libre los decide la RPC con la
 * sesión del usuario; `request_cancellation_reasons` no se lee por tabla.
 */
export async function getRequestCancellationHistoryRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<ActionResult<RequestCancellationHistory, HistoryErrorCode>> {
  const parsed = RPC_CONTRACTS.get_request_cancellation_history.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');

  const { requestId, limit, cursor } = parsed.data;
  try {
    const { data, error } = await client.rpc('get_request_cancellation_history', {
      p_request_id: requestId,
      p_limit: limit ?? null,
      p_before_created_at: cursor?.beforeCreatedAt ?? null,
      p_before_id: cursor?.beforeId ?? null,
    });
    if (error) return err(mapHistoryRpcError(error));

    const output = RPC_CONTRACTS.get_request_cancellation_history.outputSchema.safeParse(data);
    if (!output.success || output.data.requestId !== requestId) {
      return err('INTERNAL_ERROR');
    }

    return ok(output.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}

/** T-373: la misma frontera con el cliente de sesión del request (cookies); nunca con service role. */
export async function getRequestCancellationHistoryServer(
  rawInput: unknown
): Promise<ActionResult<RequestCancellationHistory, HistoryErrorCode>> {
  try {
    const client = await createClient();
    return await getRequestCancellationHistoryRpc(client, rawInput);
  } catch {
    return err('INTERNAL_ERROR');
  }
}
