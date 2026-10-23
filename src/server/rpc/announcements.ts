import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcErrorCode,
  type RpcInput,
  type RpcOutput,
} from '@/domain';
import type { SupabaseRpcCaller, SupabaseRpcErrorLike } from './admin';

export type AnnouncementRpcName =
  | 'admin_count_announcement_audience'
  | 'admin_create_announcement'
  | 'admin_record_announcement_push'
  | 'admin_list_announcements'
  | 'get_my_announcement'
  | 'dismiss_announcement'
  | 'set_promotions_opt_in';

export type AnnouncementRpcResult<K extends AnnouncementRpcName> = ActionResult<
  RpcOutput<K>,
  RpcErrorCode<K> | 'VALIDATION_ERROR' | 'INTERNAL_ERROR'
>;

/** CC-040: argumentos de Postgres de cada RPC, a partir de la entrada ya validada por su contrato. */
const ARGS: { readonly [K in AnnouncementRpcName]: (input: RpcInput<K>) => Record<string, unknown> | undefined } = {
  admin_count_announcement_audience: (input) => ({ p_audience: input.audience }),
  admin_create_announcement: (input) => ({
    p_audience: input.audience,
    p_title: input.title,
    p_body: input.body,
    p_cta: input.cta,
    p_visible_days: input.visibleDays,
  }),
  admin_record_announcement_push: (input) => ({
    p_announcement_id: input.announcementId,
    p_targets: input.targets,
    p_sent: input.sent,
    p_failed: input.failed,
  }),
  admin_list_announcements: (input) => ({
    p_cursor_created_at: input.cursor?.createdAt ?? null,
    p_cursor_id: input.cursor?.id ?? null,
    p_limit: input.limit ?? null,
  }),
  get_my_announcement: () => undefined,
  dismiss_announcement: (input) => ({ p_announcement_id: input.announcementId }),
  set_promotions_opt_in: (input) => ({ p_enabled: input.enabled }),
};

function mapAnnouncementError<K extends AnnouncementRpcName>(
  name: K,
  error: SupabaseRpcErrorLike
): RpcErrorCode<K> | 'INTERNAL_ERROR' {
  const allowed: readonly string[] = RPC_CONTRACTS[name].errorCodes;
  const message = error.message.trim();
  if (error.code === 'P0001' && allowed.includes(message)) {
    return message as RpcErrorCode<K>;
  }
  if (error.code === '42501' || error.code === '28000') {
    return 'UNAUTHORIZED_ACTOR' as RpcErrorCode<K>;
  }
  return 'INTERNAL_ERROR';
}

/**
 * CC-040: wrapper tipado de las RPC de novedades. Valida la entrada con su contrato antes de llamar a la base y la
 * salida después; la autorización, el tope diario y el público viven en Postgres.
 */
export async function callAnnouncementRpc<K extends AnnouncementRpcName>(
  client: SupabaseRpcCaller,
  name: K,
  rawInput: unknown
): Promise<AnnouncementRpcResult<K>> {
  const contract = RPC_CONTRACTS[name];
  const parsedInput = contract.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  const { data, error } = await client.rpc(name, ARGS[name](parsedInput.data as RpcInput<K>));
  if (error) {
    return err(mapAnnouncementError(name, error));
  }

  const parsedOutput = contract.outputSchema.safeParse(data);
  if (!parsedOutput.success) {
    return err('INTERNAL_ERROR');
  }
  return ok(parsedOutput.data as RpcOutput<K>);
}
