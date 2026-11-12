import 'server-only';

import { RPC_CONTRACTS, err, ok, type ActionResult, type RpcErrorCode, type RpcOutput } from '@/domain';
import type { SupabaseRpcCaller, SupabaseRpcErrorLike } from './admin';

type AdminListApplicantsResult = ActionResult<
  RpcOutput<'admin_list_applicants'>,
  RpcErrorCode<'admin_list_applicants'> | 'INTERNAL_ERROR'
>;

/** Error de Postgres → código del contrato de `admin_list_applicants`; lo desconocido cae en `INTERNAL_ERROR`. */
export function mapAdminListApplicantsError(
  error: SupabaseRpcErrorLike
): RpcErrorCode<'admin_list_applicants'> | 'INTERNAL_ERROR' {
  const allowed: readonly string[] = RPC_CONTRACTS.admin_list_applicants.errorCodes;
  const message = error.message.trim();
  if (error.code === 'P0001' && allowed.includes(message)) {
    return message as RpcErrorCode<'admin_list_applicants'>;
  }
  if (error.code === '42501' || error.code === '28000') {
    return 'UNAUTHORIZED_ACTOR';
  }
  return 'INTERNAL_ERROR';
}

/**
 * CC-044: wrapper tipado de `public.admin_list_applicants(p_status, p_query, p_cursor_created_at, p_cursor_id,
 * p_direction, p_limit)`. La búsqueda sin tildes, el filtro de envío, el total, el keyset y la exigencia de aal2 viven
 * en Postgres.
 */
export async function adminListApplicantsRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<AdminListApplicantsResult> {
  const parsedInput = RPC_CONTRACTS.admin_list_applicants.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { status, query, cursor, direction, limit } = parsedInput.data;
  const { data, error } = await client.rpc('admin_list_applicants', {
    p_status: status,
    p_query: query || null,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_direction: direction ?? 'next',
    p_limit: limit ?? null,
  });

  if (error) {
    return err(mapAdminListApplicantsError(error));
  }

  const parsedOutput = RPC_CONTRACTS.admin_list_applicants.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

type AdminFindDisputeCandidatesResult = ActionResult<
  RpcOutput<'admin_find_courier_dispute_candidates'>,
  RpcErrorCode<'admin_find_courier_dispute_candidates'> | 'INTERNAL_ERROR'
>;

/**
 * CC-050 (D4-B): wrapper tipado de `public.admin_find_courier_dispute_candidates(p_lookup)`. Busca reclamantes de un
 * DNI (pending sin enviar con documentos) por UUID exacto o teléfono completo; aal2 y filtros viven en Postgres.
 */
export async function adminFindCourierDisputeCandidatesRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<AdminFindDisputeCandidatesResult> {
  const parsedInput = RPC_CONTRACTS.admin_find_courier_dispute_candidates.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { data, error } = await client.rpc('admin_find_courier_dispute_candidates', {
    p_lookup: parsedInput.data.lookup.trim(),
  });

  if (error) {
    const allowed: readonly string[] = RPC_CONTRACTS.admin_find_courier_dispute_candidates.errorCodes;
    const message = error.message.trim();
    if (error.code === 'P0001' && allowed.includes(message)) {
      return err(message as RpcErrorCode<'admin_find_courier_dispute_candidates'>);
    }
    if (error.code === '42501' || error.code === '28000') {
      return err('UNAUTHORIZED_ACTOR');
    }
    return err('INTERNAL_ERROR');
  }

  const parsedOutput = RPC_CONTRACTS.admin_find_courier_dispute_candidates.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

type AdminFindDniReservationResult = ActionResult<
  RpcOutput<'admin_find_courier_dni_reservation'>,
  RpcErrorCode<'admin_find_courier_dni_reservation'> | 'INTERNAL_ERROR'
>;

/**
 * CC-050 (PR711-H03): wrapper tipado de `public.admin_find_courier_dni_reservation(p_dni_hmac)`. Recibe el hash ya
 * calculado en el servidor; devuelve solo cuenta y estado de quien reservó el DNI. Nunca registra el hash.
 */
export async function adminFindCourierDniReservationRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<AdminFindDniReservationResult> {
  const parsedInput = RPC_CONTRACTS.admin_find_courier_dni_reservation.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { data, error } = await client.rpc('admin_find_courier_dni_reservation', {
    p_dni_hmac: parsedInput.data.dniHmac,
  });

  if (error) {
    const allowed: readonly string[] = RPC_CONTRACTS.admin_find_courier_dni_reservation.errorCodes;
    const message = error.message.trim();
    if (error.code === 'P0001' && allowed.includes(message)) {
      return err(message as RpcErrorCode<'admin_find_courier_dni_reservation'>);
    }
    if (error.code === '42501' || error.code === '28000') {
      return err('UNAUTHORIZED_ACTOR');
    }
    return err('INTERNAL_ERROR');
  }

  const parsedOutput = RPC_CONTRACTS.admin_find_courier_dni_reservation.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}
