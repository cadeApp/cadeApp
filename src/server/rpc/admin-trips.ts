import 'server-only';

import { RPC_CONTRACTS, err, ok, type ActionResult, type RpcErrorCode, type RpcOutput } from '@/domain';
import type { SupabaseRpcCaller, SupabaseRpcErrorLike } from './admin';

type AdminListTripsResult = ActionResult<
  RpcOutput<'admin_list_trips'>,
  RpcErrorCode<'admin_list_trips'> | 'INTERNAL_ERROR'
>;

/** Error de Postgres → código del contrato de `admin_list_trips`; lo desconocido cae en `INTERNAL_ERROR`. */
export function mapAdminListTripsError(
  error: SupabaseRpcErrorLike
): RpcErrorCode<'admin_list_trips'> | 'INTERNAL_ERROR' {
  const allowed: readonly string[] = RPC_CONTRACTS.admin_list_trips.errorCodes;
  const message = error.message.trim();
  if (error.code === 'P0001' && allowed.includes(message)) {
    return message as RpcErrorCode<'admin_list_trips'>;
  }
  if (error.code === '42501' || error.code === '28000') {
    return 'UNAUTHORIZED_ACTOR';
  }
  return 'INTERNAL_ERROR';
}

/**
 * CC-037: wrapper tipado de `public.admin_list_trips(p_filter, p_cursor_created_at, p_cursor_id, p_limit)`.
 * El filtro «Con problemas», el keyset (created_at DESC, id DESC) y la exigencia de aal2 viven en Postgres.
 */
export async function adminListTripsRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<AdminListTripsResult> {
  const parsedInput = RPC_CONTRACTS.admin_list_trips.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { filter, cursor, limit } = parsedInput.data;
  const { data, error } = await client.rpc('admin_list_trips', {
    p_filter: filter,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit ?? null,
  });

  if (error) {
    return err(mapAdminListTripsError(error));
  }

  const parsedOutput = RPC_CONTRACTS.admin_list_trips.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}
