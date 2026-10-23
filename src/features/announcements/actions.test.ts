import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countAnnouncementAudienceAction,
  createAnnouncementAction,
  dismissAnnouncementAction,
  setPromotionsOptInAction,
} from './actions';

const mocks = vi.hoisted(() => ({
  client: { rpc: vi.fn() },
  call: vi.fn(),
  recipients: vi.fn(),
  send: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/server/supabase/server', () => ({ createClient: vi.fn(async () => mocks.client) }));
vi.mock('@/server/rpc/announcements', () => ({ callAnnouncementRpc: mocks.call }));
vi.mock('@/server/push', () => ({
  announcementPushUrl: (audience: string, cta: string) => `url:${audience}:${cta}`,
  getAnnouncementPushRecipients: mocks.recipients,
  sendPushNotification: mocks.send,
}));

const ANNOUNCEMENT_ID = '90000000-0000-4000-8000-000000000001';
const INPUT = {
  audience: 'merchants',
  title: 'Promo',
  body: 'Hoy los viajes múltiples cuestan 1 crédito',
  cta: 'merchant_plan',
  visibleDays: 7,
};
const CREATED = { ok: true, data: { announcementId: ANNOUNCEMENT_ID, visibleUntil: '2026-10-29T12:00:00.000000Z' } };

describe('T-414: createAnnouncementAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea, envía el push a los destinatarios y registra el resultado', async () => {
    mocks.call.mockImplementation(async (_client: unknown, name: string) =>
      name === 'admin_create_announcement' ? CREATED : { ok: true, data: { announcementId: ANNOUNCEMENT_ID } }
    );
    mocks.recipients.mockResolvedValue(['u1', 'u2']);
    mocks.send.mockResolvedValue({ totalSubscriptions: 3, sentCount: 2, failedCount: 1, errors: [] });

    await expect(createAnnouncementAction(INPUT)).resolves.toEqual({
      ok: true,
      data: {
        announcementId: ANNOUNCEMENT_ID,
        visibleUntil: CREATED.data.visibleUntil,
        push: { targets: 3, sent: 2, failed: 1 },
      },
    });
    expect(mocks.call).toHaveBeenNthCalledWith(1, mocks.client, 'admin_create_announcement', INPUT);
    expect(mocks.recipients).toHaveBeenCalledWith(ANNOUNCEMENT_ID);
    expect(mocks.send).toHaveBeenCalledWith(['u1', 'u2'], {
      event: 'announcement',
      announcementId: ANNOUNCEMENT_ID,
      title: INPUT.title,
      body: INPUT.body,
      url: 'url:merchants:merchant_plan',
    });
    expect(mocks.call).toHaveBeenNthCalledWith(2, mocks.client, 'admin_record_announcement_push', {
      announcementId: ANNOUNCEMENT_ID,
      targets: 3,
      sent: 2,
      failed: 1,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith('/admin/announcements');
  });

  it('si el alta falla, no se envía nada', async () => {
    mocks.call.mockResolvedValue({ ok: false, code: 'RATE_LIMITED' });
    await expect(createAnnouncementAction(INPUT)).resolves.toEqual({ ok: false, code: 'RATE_LIMITED' });
    expect(mocks.recipients).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it('un push que falla no deshace la novedad', async () => {
    mocks.call.mockResolvedValue(CREATED);
    mocks.recipients.mockRejectedValue(new Error('permission denied'));
    await expect(createAnnouncementAction(INPUT)).resolves.toEqual({
      ok: true,
      data: { announcementId: ANNOUNCEMENT_ID, visibleUntil: CREATED.data.visibleUntil, push: null },
    });
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).toHaveBeenCalledWith('/admin/announcements');
  });

  it('una entrada inválida devuelve el error del wrapper sin enviar', async () => {
    mocks.call.mockResolvedValue({ ok: false, code: 'VALIDATION_ERROR' });
    await expect(createAnnouncementAction({ ...INPUT, cta: 'courier_feed' })).resolves.toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe('T-414: acciones del banner y del conteo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cuenta destinatarios con el cliente de sesión', async () => {
    mocks.call.mockResolvedValue({ ok: true, data: { recipients: 3, pushRecipients: 1 } });
    await expect(countAnnouncementAudienceAction('all')).resolves.toEqual({
      ok: true,
      data: { recipients: 3, pushRecipients: 1 },
    });
    expect(mocks.call).toHaveBeenCalledWith(mocks.client, 'admin_count_announcement_audience', { audience: 'all' });
  });

  it('cerrar y darse de baja llaman a su RPC y refrescan las home', async () => {
    mocks.call.mockResolvedValue({ ok: true, data: { dismissed: true } });
    await dismissAnnouncementAction(ANNOUNCEMENT_ID);
    expect(mocks.call).toHaveBeenCalledWith(mocks.client, 'dismiss_announcement', { announcementId: ANNOUNCEMENT_ID });

    mocks.call.mockResolvedValue({ ok: true, data: { enabled: false } });
    await expect(setPromotionsOptInAction(false)).resolves.toEqual({ ok: true, data: { enabled: false } });
    expect(mocks.call).toHaveBeenCalledWith(mocks.client, 'set_promotions_opt_in', { enabled: false });
    expect(mocks.revalidate).toHaveBeenCalledWith('/merchant/dashboard');
    expect(mocks.revalidate).toHaveBeenCalledWith('/courier/feed');
  });

  it('una falla de conexión se devuelve como INTERNAL_ERROR', async () => {
    mocks.call.mockRejectedValue(new Error('fetch failed'));
    await expect(dismissAnnouncementAction(ANNOUNCEMENT_ID)).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    await expect(setPromotionsOptInAction(true)).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    await expect(countAnnouncementAudienceAction('merchants')).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    await expect(createAnnouncementAction(INPUT)).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });
});
