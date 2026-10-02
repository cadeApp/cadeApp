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

export type RequestOfferCourier = RpcOutput<'get_request_offer_couriers'>['couriers'][number];

function mapOfferCouriersRpcError(
  error: SupabaseRpcErrorLike
): RpcErrorCode<'get_request_offer_couriers'> {
  const candidate = error.message.trim();
  const allowed: readonly string[] = RPC_CONTRACTS.get_request_offer_couriers.errorCodes;
  if (error.code === 'P0001' && allowed.includes(candidate)) {
    return candidate as RpcErrorCode<'get_request_offer_couriers'>;
  }
  if (error.code === '42501' || error.code === '28000') {
    return 'UNAUTHORIZED_ACTOR';
  }
  return 'INTERNAL_ERROR';
}

/**
 * CC-016: proyección mínima de los repartidores que ofertaron en una solicitud, para el comercio dueño.
 * El comercio no lee `couriers` ni `profiles` por RLS; esta RPC es la única frontera.
 */
export async function getRequestOfferCouriersRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<
  ActionResult<
    ReadonlyMap<string, RequestOfferCourier>,
    RpcErrorCode<'get_request_offer_couriers'>
  >
> {
  const parsed = RPC_CONTRACTS.get_request_offer_couriers.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');

  try {
    const { data, error } = await client.rpc('get_request_offer_couriers', {
      p_request_id: parsed.data.requestId,
    });
    if (error) return err(mapOfferCouriersRpcError(error));

    const output = RPC_CONTRACTS.get_request_offer_couriers.outputSchema.safeParse(data);
    if (!output.success || output.data.requestId !== parsed.data.requestId) {
      return err('INTERNAL_ERROR');
    }

    return ok(new Map(output.data.couriers.map((courier) => [courier.courierId, courier])));
  } catch {
    return err('INTERNAL_ERROR');
  }
}
