import { describe, expect, it, vi } from 'vitest';
import type { SupabaseRpcCaller } from './admin';
import { callAnnouncementRpc } from './announcements';

vi.mock('server-only', () => ({}));

const ANNOUNCEMENT_ID = '90000000-0000-4000-8000-000000000001';

function caller(response: { data: unknown; error: { code?: string; message: string } | null }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
  const client: SupabaseRpcCaller = {
    async rpc(fn, args) {
      calls.push({ fn, args });
      return response;
    },
  };
  return { client, calls };
}

describe('CC-040: callAnnouncementRpc', () => {
  it('traduce cada RPC a sus argumentos de Postgres', async () => {
    const cases = [
      ['admin_count_announcement_audience', { audience: 'all' }, { p_audience: 'all' }, { recipients: 3, pushRecipients: 1 }],
      [
        'admin_create_announcement',
        { audience: 'merchants', title: ' Promo ', body: 'Texto', cta: 'merchant_plan', visibleDays: 7 },
        { p_audience: 'merchants', p_title: 'Promo', p_body: 'Texto', p_cta: 'merchant_plan', p_visible_days: 7 },
        { announcementId: ANNOUNCEMENT_ID, visibleUntil: '2026-10-29T12:00:00.000000Z' },
      ],
      [
        'admin_record_announcement_push',
        { announcementId: ANNOUNCEMENT_ID, targets: 3, sent: 2, failed: 1 },
        { p_announcement_id: ANNOUNCEMENT_ID, p_targets: 3, p_sent: 2, p_failed: 1 },
        { announcementId: ANNOUNCEMENT_ID },
      ],
      [
        'admin_list_announcements',
        { cursor: { createdAt: '2026-10-22T12:00:00.000000Z', id: ANNOUNCEMENT_ID }, limit: 10 },
        { p_cursor_created_at: '2026-10-22T12:00:00.000000Z', p_cursor_id: ANNOUNCEMENT_ID, p_limit: 10 },
        { items: [], nextCursor: null },
      ],
      ['get_my_announcement', {}, undefined, { announcement: null }],
      ['dismiss_announcement', { announcementId: ANNOUNCEMENT_ID }, { p_announcement_id: ANNOUNCEMENT_ID }, { dismissed: true }],
      ['set_promotions_opt_in', { enabled: false }, { p_enabled: false }, { enabled: false }],
    ] as const;

    for (const [name, input, args, data] of cases) {
      const { client, calls } = caller({ data, error: null });
      await expect(callAnnouncementRpc(client, name, input)).resolves.toEqual({ ok: true, data });
      expect(calls).toEqual([{ fn: name, args }]);
    }
  });

  it('el historial sin cursor manda nulos', async () => {
    const { client, calls } = caller({ data: { items: [], nextCursor: null }, error: null });
    await callAnnouncementRpc(client, 'admin_list_announcements', {});
    expect(calls[0]?.args).toEqual({ p_cursor_created_at: null, p_cursor_id: null, p_limit: null });
  });

  it('una entrada inválida no llega a la base', async () => {
    const { client, calls } = caller({ data: null, error: null });
    await expect(
      callAnnouncementRpc(client, 'admin_create_announcement', {
        audience: 'all',
        title: 'T',
        body: 'B',
        cta: 'merchant_plan',
        visibleDays: 7,
      })
    ).resolves.toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(calls).toHaveLength(0);
  });

  it('mapea los errores del contrato; lo demás es INTERNAL_ERROR', async () => {
    const limited = caller({ data: null, error: { code: 'P0001', message: 'RATE_LIMITED' } });
    await expect(
      callAnnouncementRpc(limited.client, 'admin_create_announcement', {
        audience: 'all',
        title: 'T',
        body: 'B',
        cta: 'none',
        visibleDays: 7,
      })
    ).resolves.toEqual({ ok: false, code: 'RATE_LIMITED' });

    const foreign = caller({ data: null, error: { code: 'P0001', message: 'PLAN_IN_USE' } });
    await expect(callAnnouncementRpc(foreign.client, 'get_my_announcement', {})).resolves.toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    const denied = caller({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(callAnnouncementRpc(denied.client, 'get_my_announcement', {})).resolves.toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
  });

  it('una respuesta fuera de contrato es INTERNAL_ERROR', async () => {
    const { client } = caller({
      data: { announcement: { id: ANNOUNCEMENT_ID, title: 'T', body: 'B', cta: 'none', audience: 'all' } },
      error: null,
    });
    await expect(callAnnouncementRpc(client, 'get_my_announcement', {})).resolves.toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });
});
