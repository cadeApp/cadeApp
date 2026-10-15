import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcErrorCode,
  type RpcOutput,
} from '@/domain';
import type { SupabaseRpcCaller, SupabaseRpcErrorLike } from './admin';

export type ReplaceCourierDocumentResult = RpcOutput<'replace_courier_document'>;

function isAllowedReplaceError(
  candidate: string,
): candidate is RpcErrorCode<'replace_courier_document'> {
  const allowedCodes: readonly string[] =
    RPC_CONTRACTS.replace_courier_document.errorCodes;
  return allowedCodes.includes(candidate as RpcErrorCode<'replace_courier_document'>);
}

/**
 * Maps PostgREST / Postgres errors returned by `replace_courier_document` into strict `RpcErrorCode<'replace_courier_document'> | 'INTERNAL_ERROR'`.
 */
export function mapReplaceCourierDocumentRpcError(
  error: SupabaseRpcErrorLike,
): RpcErrorCode<'replace_courier_document'> | 'INTERNAL_ERROR' {
  const trimmedMessage = error.message.trim();

  if (isAllowedReplaceError(trimmedMessage)) {
    return trimmedMessage;
  }

  for (const allowedCode of RPC_CONTRACTS.replace_courier_document.errorCodes) {
    if (trimmedMessage.includes(allowedCode)) {
      return allowedCode as RpcErrorCode<'replace_courier_document'>;
    }
  }

  if (
    (error.code === '42501' || error.code === '28000') &&
    isAllowedReplaceError('UNAUTHORIZED_ACTOR')
  ) {
    return 'UNAUTHORIZED_ACTOR';
  }

  return 'INTERNAL_ERROR';
}

/**
 * Typed server wrapper for `public.replace_courier_document(p_payload jsonb)`.
 * CC-025: Reemplazo transaccional de un documento rechazado del repartidor.
 */
export async function replaceCourierDocumentRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    ReplaceCourierDocumentResult,
    RpcErrorCode<'replace_courier_document'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.replace_courier_document.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  try {
    const { data, error } = await client.rpc('replace_courier_document', {
      p_payload: {
        kind: parsedInput.data.kind,
        storagePath: parsedInput.data.storagePath,
        ...(parsedInput.data.idempotencyKey
          ? { idempotencyKey: parsedInput.data.idempotencyKey }
          : {}),
      },
    });

    if (error) {
      return err(mapReplaceCourierDocumentRpcError(error));
    }

    const parsedOutput =
      RPC_CONTRACTS.replace_courier_document.outputSchema.safeParse(data);
    if (!parsedOutput.success) {
      return err('INTERNAL_ERROR');
    }

    return ok(parsedOutput.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}
