// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultPushDatabaseClient, WebPushTransport } from './sender';
import { createAdminClient } from '@/server/supabase/admin';

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/server/env', () => ({
  serverEnv: {
    VAPID_PRIVATE_KEY: 'test-private-key',
    VAPID_SUBJECT: 'mailto:test@cadeapp.com',
  },
}));

vi.mock('@/lib/env.public', () => ({
  publicEnv: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'test-public-key',
  },
}));

describe('DefaultPushDatabaseClient', () => {
  const USER_1 = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna arreglo vacío si userIds está vacío sin consultar la base de datos', async () => {
    const client = new DefaultPushDatabaseClient();
    const subs = await client.getSubscriptionsForUsers([]);
    expect(subs).toEqual([]);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('consulta push_subscriptions y mapea los registros correctamente', async () => {
    const mockIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'sub-1',
          user_id: USER_1,
          endpoint: 'https://push.example.com/sub/1',
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
      ],
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const client = new DefaultPushDatabaseClient();
    const subs = await client.getSubscriptionsForUsers([USER_1]);

    expect(subs).toEqual([
      {
        id: 'sub-1',
        userId: USER_1,
        endpoint: 'https://push.example.com/sub/1',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      },
    ]);

    expect(mockFrom).toHaveBeenCalledWith('push_subscriptions');
    expect(mockSelect).toHaveBeenCalledWith('id, user_id, endpoint, p256dh, auth');
    expect(mockIn).toHaveBeenCalledWith('user_id', [USER_1]);
  });

  it('lanza error si la consulta a la base de datos falla', async () => {
    const mockIn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database query failed' },
    });
    const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const client = new DefaultPushDatabaseClient();
    await expect(client.getSubscriptionsForUsers([USER_1])).rejects.toThrow(
      'Failed to query push_subscriptions: Database query failed'
    );
  });

  it('elimina la suscripción filtrando por endpoint', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const client = new DefaultPushDatabaseClient();
    await client.deleteSubscriptionByEndpoint('https://push.example.com/sub/1');

    expect(mockFrom).toHaveBeenCalledWith('push_subscriptions');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('endpoint', 'https://push.example.com/sub/1');
  });

  it('lanza error si la eliminación por endpoint falla', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Delete constraint failure' } });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const client = new DefaultPushDatabaseClient();
    await expect(
      client.deleteSubscriptionByEndpoint('https://push.example.com/sub/1')
    ).rejects.toThrow('Failed to delete expired push subscription: Delete constraint failure');
  });
});
