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
import { sendCriticalAlert } from '@/server/observability';
import type { SupabaseRpcCaller } from './offers';

type RequestRpcName =
  | 'publish_request'
  | 'cancel_request'
  | 'mark_picked_up'
  | 'mark_delivered'
  | 'report_no_show'
  | 'courier_cancel_match'
  | 'republish_request'
  | 'report_incident';

export async function callRequestRpc<K extends RequestRpcName>(
  client: SupabaseRpcCaller,
  rpcName: K,
  rawInput: unknown
): Promise<ActionResult<RpcOutput<K>, RpcErrorCode<K>>> {
  const contract = RPC_CONTRACTS[rpcName];
  const parsed = contract.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');

  const input = parsed.data;
  const args: Record<string, unknown> = { p_request_id: input.requestId };
  if (
    rpcName === 'cancel_request' ||
    rpcName === 'republish_request' ||
    rpcName === 'courier_cancel_match'
  ) {
    args.p_reason = 'reason' in input ? (input.reason ?? null) : null;
  }
  if (rpcName === 'report_no_show') {
    args.p_republish = 'republish' in input ? (input.republish ?? true) : true;
  }
  if ('kind' in input && 'description' in input) {
    args.p_kind = input.kind;
    args.p_description = input.description;
  }

  try {
    const { data, error } = await client.rpc(rpcName, args);
    if (error) {
      const allowed: readonly string[] = contract.errorCodes;
      const code = error.message.trim();
      if (error.code === 'P0001' && allowed.includes(code)) {
        return err(code as RpcErrorCode<K>);
      }
      if (rpcName === 'publish_request') {
        try {
          await sendCriticalAlert({
            type: 'publish_request_failed',
            severity: 'critical',
            message: `Fallo en RPC publish_request: ${error.message}`,
            details: { error: error.message, code: error.code, input: args },
          });
        } catch {
          // Fallo de observabilidad no debe interrumpir el retorno al caller
        }
      }
      return err('INTERNAL_ERROR');
    }
    const output = contract.outputSchema.safeParse(data);
    if (!output.success) {
      if (rpcName === 'publish_request') {
        try {
          await sendCriticalAlert({
            type: 'publish_request_failed',
            severity: 'critical',
            message: 'Error de validación en respuesta de RPC publish_request',
            details: { zodErrors: output.error.issues, data },
          });
        } catch {
          // Fallo de observabilidad no debe interrumpir el retorno al caller
        }
      }
      return err('INTERNAL_ERROR');
    }
    // The same RPC key selects both Zod schemas and the corresponding result type.
    return ok(output.data as RpcOutput<K>);
  } catch (ex) {
    if (rpcName === 'publish_request') {
      try {
        await sendCriticalAlert({
          type: 'publish_request_failed',
          severity: 'critical',
          message: `Excepción inesperada en RPC publish_request: ${ex instanceof Error ? ex.message : String(ex)}`,
          details: { error: ex instanceof Error ? ex.stack : String(ex), input: args },
        });
      } catch {
        // Fallo de observabilidad no debe interrumpir el retorno al caller
      }
    }
    return err('INTERNAL_ERROR');
  }
}

export function createRequestsRpcServerClient(
  client: SupabaseRpcCaller
): Pick<RpcClientContract, RequestRpcName> {
  return {
    publish_request: (input) => callRequestRpc(client, 'publish_request', input),
    cancel_request: (input) => callRequestRpc(client, 'cancel_request', input),
    mark_picked_up: (input) => callRequestRpc(client, 'mark_picked_up', input),
    mark_delivered: (input) => callRequestRpc(client, 'mark_delivered', input),
    report_no_show: (input) => callRequestRpc(client, 'report_no_show', input),
    courier_cancel_match: (input) => callRequestRpc(client, 'courier_cancel_match', input),
    republish_request: (input) => callRequestRpc(client, 'republish_request', input),
    report_incident: (input) => callRequestRpc(client, 'report_incident', input),
  };
}
