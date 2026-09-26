import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcErrorCode,
  type RpcOutput,
} from '@/domain';
import { sendCriticalAlert } from '@/server/observability';

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

export type DistanceRpcName = 'calculate_route_distance';

function isAllowedDistanceRpcError(
  candidate: string,
): candidate is RpcErrorCode<'calculate_route_distance'> {
  const allowedCodes: readonly string[] =
    RPC_CONTRACTS.calculate_route_distance.errorCodes;
  return (allowedCodes as readonly string[]).includes(candidate);
}

export function mapDistanceRpcError(
  error: SupabaseRpcErrorLike,
): RpcErrorCode<'calculate_route_distance'> | 'INTERNAL_ERROR' {
  const trimmedMessage = error.message.trim();

  if (isAllowedDistanceRpcError(trimmedMessage)) {
    return trimmedMessage;
  }

  for (const allowedCode of RPC_CONTRACTS.calculate_route_distance.errorCodes) {
    if (trimmedMessage.includes(allowedCode)) {
      return allowedCode;
    }
  }

  if (
    error.code === '42501' ||
    error.code === '28000' ||
    error.message.includes('permission denied')
  ) {
    return 'UNAUTHORIZED_ACTOR';
  }

  return 'INTERNAL_ERROR';
}

/**
 * Typed server wrapper for `public.calculate_route_distance(...)`.
 */
export async function calculateRouteDistanceRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    RpcOutput<'calculate_route_distance'>,
    RpcErrorCode<'calculate_route_distance'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.calculate_route_distance.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const input = parsedInput.data;
  const args: Record<string, unknown> = {
    p_pickup_lat: input.pickupLat ?? null,
    p_pickup_lng: input.pickupLng ?? null,
    p_dropoff_lat: input.dropoffLat ?? null,
    p_dropoff_lng: input.dropoffLng ?? null,
    p_pickup_zone_id: input.pickupZoneId ?? null,
    p_dropoff_zone_id: input.dropoffZoneId ?? null,
    p_pickup_zone_name: input.pickupZoneName ?? null,
    p_dropoff_zone_name: input.dropoffZoneName ?? null,
  };

  try {
    const { data, error } = await client.rpc('calculate_route_distance', args);
    if (error) {
      const mappedError = mapDistanceRpcError(error);
      return err(mappedError);
    }

    const parsedOutput =
      RPC_CONTRACTS.calculate_route_distance.outputSchema.safeParse(data);
    if (!parsedOutput.success) {
      try {
        await sendCriticalAlert({
          type: 'rpc_output_invalid',
          severity: 'critical',
          message:
            'Error de validación en respuesta de RPC calculate_route_distance',
          details: { zodErrors: parsedOutput.error.issues, data },
        });
      } catch {
        // Observability failure should not disrupt caller
      }
      return err('INTERNAL_ERROR');
    }

    return ok(parsedOutput.data);
  } catch (ex) {
    try {
      await sendCriticalAlert({
        type: 'rpc_call_exception',
        severity: 'critical',
        message: `Excepción inesperada en RPC calculate_route_distance: ${
          ex instanceof Error ? ex.message : String(ex)
        }`,
        details: {
          error: ex instanceof Error ? ex.stack : String(ex),
          input: args,
        },
      });
    } catch {
      // Observability failure should not disrupt caller
    }
    return err('INTERNAL_ERROR');
  }
}
