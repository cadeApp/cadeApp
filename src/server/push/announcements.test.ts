// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminClient } from '@/server/supabase/admin';
import {
  announcementPushUrl,
  buildPushPayload,
  getAnnouncementPushRecipients,
  sendPushNotification,
  type PushDatabaseClient,
  type PushSubscriptionRecord,
  type PushTransport,
} from './sender';

vi.mock('@/server/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/server/env', () => ({
  serverEnv: { VAPID_PRIVATE_KEY: 'test-private-key', VAPID_SUBJECT: 'mailto:test@cadeapp.com' },
}));
vi.mock('@/lib/env.public', () => ({ publicEnv: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'test-public-key' } }));

const ANNOUNCEMENT_ID = '90000000-0000-4000-8000-000000000001';
const event = {
  event: 'announcement' as const,
  announcementId: ANNOUNCEMENT_ID,
  title: 'Hoy los viajes múltiples cuestan 1 crédito',
  body: 'Aprovechá la promo de hoy.',
  url: '/merchant/plan' as const,
};

describe('T-414 / CC-040: evento push announcement', () => {
  it('el payload lleva solo id, título, texto y una url de la lista fija', () => {
    expect(buildPushPayload(event)).toEqual(event);
    expect(() => buildPushPayload({ ...event, extra: 1 } as never)).toThrow();
    expect(() => buildPushPayload({ ...event, title: 'x'.repeat(61) })).toThrow();
    expect(() => buildPushPayload({ ...event, body: '' })).toThrow();
    expect(() => buildPushPayload({ ...event, url: 'https://evil.example/' } as never)).toThrow();
    expect(() => buildPushPayload({ ...event, announcementId: 'no-uuid' })).toThrow();
  });

  it('la url sale de la acción o de la home del público', () => {
    expect(announcementPushUrl('merchants', 'merchant_plan')).toBe('/merchant/plan');
    expect(announcementPushUrl('merchants', 'merchant_new_request')).toBe('/merchant/requests/new');
    expect(announcementPushUrl('couriers', 'courier_feed')).toBe('/courier/feed');
    expect(announcementPushUrl('merchants', 'none')).toBe('/merchant/dashboard');
    expect(announcementPushUrl('couriers', 'none')).toBe('/courier/feed');
    expect(announcementPushUrl('all', 'none')).toBe('/login');
  });
});

describe('T-414: envío en tandas de 10', () => {
  it('nunca hay más de 10 envíos en vuelo y se mandan todos', async () => {
    const subscriptions: PushSubscriptionRecord[] = Array.from({ length: 25 }, (_, index) => ({
      id: `sub-${index}`,
      userId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      endpoint: `https://push.example.com/sub/${index}`,
      p256dh: 'p256dh',
      auth: 'auth',
    }));
    const db: PushDatabaseClient = {
      getSubscriptionsForUsers: vi.fn(async () => subscriptions),
      deleteSubscriptionByEndpoint: vi.fn(async () => undefined),
    };
    let inFlight = 0;
    let maxInFlight = 0;
    const transport: PushTransport = {
      send: vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return { status: 201 };
      }),
    };

    const result = await sendPushNotification(
      subscriptions.map((sub) => sub.userId),
      event,
      { db, transport }
    );

    expect(result.sentCount).toBe(25);
    expect(result.attempts).toHaveLength(25);
    expect(maxInFlight).toBe(10);
  });
});

describe('T-414: destinatarios del push de una novedad', () => {
  beforeEach(() => vi.clearAllMocks());

  it('los pide a announcement_push_recipients con el cliente de servicio', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ['00000000-0000-4000-8000-000000400002'], error: null });
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>);

    await expect(getAnnouncementPushRecipients(ANNOUNCEMENT_ID)).resolves.toEqual([
      '00000000-0000-4000-8000-000000400002',
    ]);
    expect(rpc).toHaveBeenCalledWith('announcement_push_recipients', { p_announcement_id: ANNOUNCEMENT_ID });
  });

  it('un error o una respuesta fuera de forma se lanzan', async () => {
    const failing = vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    vi.mocked(createAdminClient).mockReturnValue({ rpc: failing } as unknown as ReturnType<typeof createAdminClient>);
    await expect(getAnnouncementPushRecipients(ANNOUNCEMENT_ID)).rejects.toThrow('permission denied');

    const malformed = vi.fn().mockResolvedValue({ data: ['no-uuid'], error: null });
    vi.mocked(createAdminClient).mockReturnValue({ rpc: malformed } as unknown as ReturnType<typeof createAdminClient>);
    await expect(getAnnouncementPushRecipients(ANNOUNCEMENT_ID)).rejects.toThrow();
  });
});
