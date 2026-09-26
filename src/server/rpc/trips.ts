import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcErrorCode,
  type RpcOutput,
} from '@/domain';
import { createAdminClient } from '@/server/supabase/admin';
import { createClient } from '@/server/supabase/server';
import type { SupabaseRpcCaller, SupabaseRpcErrorLike } from './offers';

export const TRIP_AVATAR_SIGNED_URL_TTL_SECONDS = 300;

export type TripDetailsServerOutput = RpcOutput<'get_trip_details'> & {
  readonly avatarUrl: string | null;
};

function mapTripRpcError(error: SupabaseRpcErrorLike): RpcErrorCode<'get_trip_details'> {
  const candidate = error.message.trim();
  const allowed: readonly string[] = RPC_CONTRACTS.get_trip_details.errorCodes;
  if (error.code === 'P0001' && allowed.includes(candidate)) {
    return candidate as RpcErrorCode<'get_trip_details'>;
  }
  if ((error.code === '42501' || error.code === '28000') && allowed.includes('UNAUTHORIZED_ACTOR')) {
    return 'UNAUTHORIZED_ACTOR';
  }
  return 'INTERNAL_ERROR';
}

export async function getTripDetailsRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown
): Promise<ActionResult<RpcOutput<'get_trip_details'>, RpcErrorCode<'get_trip_details'>>> {
  const parsed = RPC_CONTRACTS.get_trip_details.inputSchema.safeParse(rawInput);
  if (!parsed.success) return err('VALIDATION_ERROR');

  try {
    const { data, error } = await client.rpc('get_trip_details', {
      p_request_id: parsed.data.requestId,
    });
    if (error) return err(mapTripRpcError(error));

    const output = RPC_CONTRACTS.get_trip_details.outputSchema.safeParse(data);
    if (!output.success) return err('INTERNAL_ERROR');

    return ok(output.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}

export async function getTripDetailsServer(
  rawInput: unknown
): Promise<ActionResult<TripDetailsServerOutput, RpcErrorCode<'get_trip_details'>>> {
  const client = await createClient();
  const rpcResult = await getTripDetailsRpc(client, rawInput);
  if (!rpcResult.ok) return rpcResult;

  const admin = createAdminClient();
  const { data: avatarDoc, error: avatarDocError } = await admin
    .from('courier_documents')
    .select('storage_path')
    .eq('courier_id', rpcResult.data.courierId)
    .eq('kind', 'avatar')
    .eq('status', 'verified')
    .is('purged_at', null)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (avatarDocError) return err('INTERNAL_ERROR');
  if (!avatarDoc) return ok({ ...rpcResult.data, avatarUrl: null });

  const { data: signed, error: signedError } = await admin.storage
    .from('courier-docs')
    .createSignedUrl(avatarDoc.storage_path, TRIP_AVATAR_SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) return err('INTERNAL_ERROR');

  return ok({ ...rpcResult.data, avatarUrl: signed.signedUrl });
}
