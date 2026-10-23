'use server';

import { revalidatePath } from 'next/cache';
import { err, ok, RPC_CONTRACTS, type ActionResult, type AnnouncementAudience, type RpcOutput } from '@/domain';
import { announcementPushUrl, getAnnouncementPushRecipients, sendPushNotification } from '@/server/push';
import { callAnnouncementRpc, type AnnouncementRpcName, type AnnouncementRpcResult } from '@/server/rpc/announcements';
import { createClient } from '@/server/supabase/server';

export interface AnnouncementPushSummary {
  readonly targets: number;
  readonly sent: number;
  readonly failed: number;
}

export type CreateAnnouncementResult = ActionResult<
  RpcOutput<'admin_create_announcement'> & { readonly push: AnnouncementPushSummary | null },
  'UNAUTHENTICATED' | 'UNAUTHORIZED_ACTOR' | 'AAL2_REQUIRED' | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'INTERNAL_ERROR'
>;

const HOME_PATHS = ['/merchant/dashboard', '/courier/feed'] as const;

async function callWithSession<K extends AnnouncementRpcName>(
  name: K,
  input: unknown
): Promise<AnnouncementRpcResult<K>> {
  try {
    return await callAnnouncementRpc(await createClient(), name, input);
  } catch {
    return err('INTERNAL_ERROR');
  }
}

/** CC-040: destinatarios estimados antes de confirmar el envío. */
export async function countAnnouncementAudienceAction(audience: AnnouncementAudience) {
  return callWithSession('admin_count_announcement_audience', { audience });
}

/**
 * CC-040: crea la novedad (la RPC exige admin aal2 y aplica el tope diario), envía el push a quienes aceptaron
 * novedades y registra el resultado. El push es best-effort: si falla, la novedad igual queda y se ve en el banner.
 */
export async function createAnnouncementAction(rawInput: unknown): Promise<CreateAnnouncementResult> {
  const created = await callWithSession('admin_create_announcement', rawInput);
  if (!created.ok) return created;

  const input = RPC_CONTRACTS.admin_create_announcement.inputSchema.parse(rawInput);
  const { announcementId } = created.data;
  let push: AnnouncementPushSummary | null = null;
  try {
    const recipients = await getAnnouncementPushRecipients(announcementId);
    const result = await sendPushNotification(recipients, {
      event: 'announcement',
      announcementId,
      title: input.title,
      body: input.body,
      url: announcementPushUrl(input.audience, input.cta),
    });
    push = { targets: result.totalSubscriptions, sent: result.sentCount, failed: result.failedCount };
    await callWithSession('admin_record_announcement_push', { announcementId, ...push });
  } catch {
    push = null;
  }

  revalidatePath('/admin/announcements');
  return ok({ ...created.data, push });
}

/** CC-040: cierra la novedad para la cuenta del comercio o repartidor. */
export async function dismissAnnouncementAction(announcementId: string) {
  const result = await callWithSession('dismiss_announcement', { announcementId });
  if (result.ok) HOME_PATHS.forEach((path) => revalidatePath(path));
  return result;
}

/** CC-040: alta (al activar los avisos) o baja (enlace del banner) de promociones. */
export async function setPromotionsOptInAction(enabled: boolean) {
  const result = await callWithSession('set_promotions_opt_in', { enabled });
  if (result.ok) HOME_PATHS.forEach((path) => revalidatePath(path));
  return result;
}
