// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runSweep } from './sweep';
import { createAdminClient } from '@/server/supabase/admin';

vi.mock('@/server/env', () => ({
  serverEnv: {
    CRON_SECRET: 'test-cron-secret-12345',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  },
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('runSweep logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('procesa correctamente expiraciones, purga y suscripciones vencidas', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [
                  { id: 'req-101', merchant_id: 'merchant-1' },
                  { id: 'req-102', merchant_id: 'merchant-2' },
                ],
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'offers') {
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }

      if (table === 'courier_documents') {
        return {
          select: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'doc-10',
                    courier_id: 'courier-1',
                    storage_path: 'courier-1/dni.jpg',
                    purge_after: '2026-08-01T00:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { key: 'subscription_grace_days', value: '2' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { profile_id: 'merchant-expired-1', paid_until: '2026-01-01' },
                { profile_id: 'merchant-active-2', paid_until: '2099-12-31' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'audit_log') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      return {};
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          remove: mockStorageRemove,
        }),
      },
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await runSweep();

    expect(result.expiredRequestsCount).toBe(2);
    expect(result.purgedDocsCount).toBe(1);
    expect(result.expiredSubscriptionsCount).toBe(1);
    expect(mockStorageRemove).toHaveBeenCalledWith(['courier-1/dni.jpg']);
  });
});
