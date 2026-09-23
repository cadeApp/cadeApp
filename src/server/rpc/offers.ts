import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcClientContract,
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

type OfferRpcName =
  | 'submit_offer'
  | 'withdraw_offer'
  | 'accept_offer'
  | 'set_availability';

function isAllowedOfferRpcError<K extends OfferRpcName>(
  rpcName: K,
  candidate: string,
): candidate is RpcErrorCode<K> {
  const allowedCodes: readonly string[] = RPC_CONTRACTS[rpcName].errorCodes;
  return allowedCodes.includes(candidate);
}

/**
 * Maps a PostgREST / Postgres error returned by `submit_offer`, `withdraw_offer`,
 * `accept_offer`, or `set_availability` into the strict `RpcErrorCode<K>` union declared in
 * `@/domain/rpc-contracts`. Unrecognized infrastructure/database errors fall back
 * to `INTERNAL_ERROR` (D03 / H02 / CC-001 / CC-002).
 */
export function mapOfferRpcError<K extends OfferRpcName>(
  rpcName: K,
  error: SupabaseRpcErrorLike,
): RpcErrorCode<K> {
  const trimmedMessage = error.message.trim();

  if (isAllowedOfferRpcError(rpcName, trimmedMessage)) {
    return trimmedMessage;
  }

  for (const allowedCode of RPC_CONTRACTS[rpcName].errorCodes) {
    if (trimmedMessage.includes(allowedCode)) {
      return allowedCode;
    }
  }

  if (
    error.code === '23505' &&
    isAllowedOfferRpcError(rpcName, 'DUPLICATE_ACTIVE_OFFER')
  ) {
    return 'DUPLICATE_ACTIVE_OFFER';
  }

  if (
    error.code === '23505' &&
    isAllowedOfferRpcError(rpcName, 'ALREADY_MATCHED')
  ) {
    return 'ALREADY_MATCHED';
  }

  if (
    (error.code === '42501' || error.code === '28000') &&
    isAllowedOfferRpcError(rpcName, 'UNAUTHORIZED_ACTOR')
  ) {
    return 'UNAUTHORIZED_ACTOR';
  }

  return 'INTERNAL_ERROR';
}

/**
 * Typed server wrapper for `public.submit_offer(p_request_id, p_amount_ars, p_eta_minutes, p_message)`.
 * Validates inputs at the boundary with `RPC_CONTRACTS.submit_offer.inputSchema` and parses the JSON response
 * with `RPC_CONTRACTS.submit_offer.outputSchema`.
 */
export async function submitOfferRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<RpcOutput<'submit_offer'>, RpcErrorCode<'submit_offer'>>
> {
  const parsedInput = RPC_CONTRACTS.submit_offer.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { requestId, amountArs, etaMinutes, message } = parsedInput.data;
  const { data, error } = await client.rpc('submit_offer', {
    p_request_id: requestId,
    p_amount_ars: amountArs,
    p_eta_minutes: etaMinutes,
    p_message: message ?? null,
  });

  if (error) {
    return err(mapOfferRpcError('submit_offer', error));
  }

  const parsedOutput = RPC_CONTRACTS.submit_offer.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

/**
 * Typed server wrapper for `public.withdraw_offer(p_offer_id)`.
 */
export async function withdrawOfferRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<RpcOutput<'withdraw_offer'>, RpcErrorCode<'withdraw_offer'>>
> {
  const parsedInput =
    RPC_CONTRACTS.withdraw_offer.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { offerId } = parsedInput.data;
  const { data, error } = await client.rpc('withdraw_offer', {
    p_offer_id: offerId,
  });

  if (error) {
    return err(mapOfferRpcError('withdraw_offer', error));
  }

  const parsedOutput = RPC_CONTRACTS.withdraw_offer.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

/**
 * Typed server wrapper for `public.accept_offer(p_offer_id)`.
 */
export async function acceptOfferRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<RpcOutput<'accept_offer'>, RpcErrorCode<'accept_offer'>>
> {
  const parsedInput = RPC_CONTRACTS.accept_offer.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { offerId } = parsedInput.data;
  const { data, error } = await client.rpc('accept_offer', {
    p_offer_id: offerId,
  });

  if (error) {
    return err(mapOfferRpcError('accept_offer', error));
  }

  const parsedOutput = RPC_CONTRACTS.accept_offer.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

/**
 * Typed server wrapper for `public.set_availability(p_available)`.
 */
export async function setAvailabilityRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<RpcOutput<'set_availability'>, RpcErrorCode<'set_availability'>>
> {
  const parsedInput =
    RPC_CONTRACTS.set_availability.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { available } = parsedInput.data;
  const { data, error } = await client.rpc('set_availability', {
    p_available: available,
  });

  if (error) {
    return err(mapOfferRpcError('set_availability', error));
  }

  const parsedOutput =
    RPC_CONTRACTS.set_availability.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }

  return ok(parsedOutput.data);
}

/**
 * Creates a server-side RPC client implementing the `submit_offer`,
 * `withdraw_offer`, `accept_offer`, and `set_availability` methods of `RpcClientContract`.
 */
export function createOffersRpcServerClient(
  client: SupabaseRpcCaller,
): Pick<
  RpcClientContract,
  'submit_offer' | 'withdraw_offer' | 'accept_offer' | 'set_availability'
> {
  return {
    submit_offer: (input) => submitOfferRpc(client, input),
    withdraw_offer: (input) => withdrawOfferRpc(client, input),
    accept_offer: (input) => acceptOfferRpc(client, input),
    set_availability: (input) => setAvailabilityRpc(client, input),
  };
}
