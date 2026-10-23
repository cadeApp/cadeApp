import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminAnnouncements, getMyAnnouncement } from './queries';

const mocks = vi.hoisted(() => ({ client: { rpc: vi.fn() }, call: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/supabase/server', () => ({ createClient: vi.fn(async () => mocks.client) }));
vi.mock('@/server/rpc/announcements', () => ({ callAnnouncementRpc: mocks.call }));

const BANNER = { id: '90000000-0000-4000-8000-000000000001', title: 'T', body: 'B', cta: 'none' };

describe('T-414: queries de novedades', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getMyAnnouncement devuelve la novedad o null', async () => {
    mocks.call.mockResolvedValue({ ok: true, data: { announcement: BANNER } });
    await expect(getMyAnnouncement()).resolves.toEqual(BANNER);
    expect(mocks.call).toHaveBeenCalledWith(mocks.client, 'get_my_announcement', {});

    mocks.call.mockResolvedValue({ ok: true, data: { announcement: null } });
    await expect(getMyAnnouncement()).resolves.toBeNull();
  });

  it('un error no rompe la home: el banner simplemente no aparece', async () => {
    mocks.call.mockResolvedValue({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    await expect(getMyAnnouncement()).resolves.toBeNull();
    mocks.call.mockRejectedValue(new Error('fetch failed'));
    await expect(getMyAnnouncement()).resolves.toBeNull();
  });

  it('getAdminAnnouncements pide de a 20, con o sin cursor', async () => {
    mocks.call.mockResolvedValue({ ok: true, data: { items: [], nextCursor: null } });
    await getAdminAnnouncements();
    expect(mocks.call).toHaveBeenLastCalledWith(mocks.client, 'admin_list_announcements', { limit: 20 });
    const cursor = { createdAt: '2026-10-22T12:00:00.000000Z', id: BANNER.id };
    await getAdminAnnouncements(cursor);
    expect(mocks.call).toHaveBeenLastCalledWith(mocks.client, 'admin_list_announcements', { limit: 20, cursor });

    mocks.call.mockRejectedValue(new Error('fetch failed'));
    await expect(getAdminAnnouncements()).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });
});
