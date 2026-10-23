import 'server-only';

import type { AdminAnnouncementsCursor, AnnouncementBanner } from '@/domain';
import { callAnnouncementRpc, type AnnouncementRpcResult } from '@/server/rpc/announcements';
import { createClient } from '@/server/supabase/server';

const PAGE_SIZE = 20;

/**
 * CC-040: la novedad vigente del comercio o repartidor autenticado. El banner es opcional: cualquier error devuelve
 * `null` y la home se ve igual.
 */
export async function getMyAnnouncement(): Promise<AnnouncementBanner | null> {
  try {
    const result = await callAnnouncementRpc(await createClient(), 'get_my_announcement', {});
    return result.ok ? result.data.announcement : null;
  } catch {
    return null;
  }
}

/** CC-040: historial del admin por keyset (`admin_list_announcements`, aal2 en Postgres). */
export async function getAdminAnnouncements(
  cursor?: AdminAnnouncementsCursor
): Promise<AnnouncementRpcResult<'admin_list_announcements'>> {
  try {
    return await callAnnouncementRpc(await createClient(), 'admin_list_announcements', {
      limit: PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
    });
  } catch {
    return { ok: false, code: 'INTERNAL_ERROR' };
  }
}
