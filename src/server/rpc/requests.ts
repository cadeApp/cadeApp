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
import { createAdminClient } from '@/server/supabase/admin';
import { safeNotifyPostTransition } from '@/server/push';
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

    // T-206: Disparo post-commit best-effort
    if (rpcName === 'publish_request') {
      try {
        const admin = createAdminClient();
        const { data: couriers, error: couriersError } = await admin
          .from('couriers')
          .select('profile_id')
          .eq('status', 'approved')
          .eq('available', true);

        if (!couriersError && couriers && couriers.length > 0) {
          const courierIds = couriers.map((c) => c.profile_id);
          await safeNotifyPostTransition(courierIds, {
            event: 'request_published',
            requestId: (output.data as { requestId: string }).requestId,
          });
        }
      } catch {
        // Best effort: falla de push nunca altera la transición exitosa
      }
    } else if (rpcName === 'cancel_request') {
      try {
        const admin = createAdminClient();
        const cancelOutput = output.data as { requestId: string; cancelledAt: string };
        const reqId = cancelOutput.requestId;
        const cancelledAt = cancelOutput.cancelledAt;

        const [offersRes, reqRes, auditRes] = await Promise.all([
          admin
            .from('offers')
            .select('courier_id')
            .eq('request_id', reqId)
            .eq('decided_at', cancelledAt)
            .in('status', ['expired', 'cancelled']),
          admin
            .from('delivery_requests')
            .select('merchant_id')
            .eq('id', reqId)
            .maybeSingle(),
          admin
            .from('audit_log')
            .select('actor_id')
            .eq('target_type', 'delivery_request')
            .eq('target_id', reqId)
            .eq('action', 'cancel_request')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        // PR118-H07: Resolución de destinatarios falla cerrada ante { error }
        if (offersRes.error || reqRes.error || auditRes.error) {
          return ok(output.data as RpcOutput<K>);
        }

        const recipients = new Set<string>();
        const merchantId = reqRes.data?.merchant_id;
        const actorId = auditRes.data?.actor_id;

        // D01/1-A: Solo actores afectados. Si el actor fue el comercio, no se le notifica a él mismo.
        // Si el actor fue otro (e.g. admin cancela in_transit), se notifica al comercio.
        if (merchantId && actorId !== merchantId) {
          recipients.add(merchantId);
        }

        if (offersRes.data) {
          for (const o of offersRes.data) {
            recipients.add(o.courier_id);
          }
        }

        if (recipients.size > 0) {
          await safeNotifyPostTransition(Array.from(recipients), {
            event: 'request_cancelled',
            requestId: reqId,
          });
        }
      } catch {
        // Best effort: falla de push nunca altera la transición exitosa
      }
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
