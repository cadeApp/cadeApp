// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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

type AdminClientMock = Partial<ReturnType<typeof createAdminClient>>;

function setAdminClientMock(mock: AdminClientMock) {
  vi.mocked(createAdminClient).mockReturnValue(mock as ReturnType<typeof createAdminClient>);
}

describe('runSweep logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('procesa correctamente expiraciones, purga y suscripciones vencidas con guardas TOCTOU y audit_log singular', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });
    const mockReqUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockOffersUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockDocUpdateIs = vi.fn().mockResolvedValue({ error: null });
    const mockMerchantUpdateEq = vi.fn().mockResolvedValue({ error: null });

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
            in: vi.fn().mockReturnValue({
              eq: mockReqUpdateEq,
            }),
          }),
        };
      }

      if (table === 'offers') {
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: mockOffersUpdateEq,
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
            in: vi.fn().mockReturnValue({
              is: mockDocUpdateIs,
            }),
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
                {
                  profile_id: 'merchant-expired-1',
                  paid_until: '2026-01-01',
                  subscription_status: 'active',
                },
                {
                  profile_id: 'merchant-active-2',
                  paid_until: '2099-12-31',
                  subscription_status: 'active',
                },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: mockMerchantUpdateEq,
            }),
          }),
        };
      }

      if (table === 'audit_log') {
        return {
          insert: mockAuditInsert,
        };
      }

      return {};
    });

    setAdminClientMock({
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          remove: mockStorageRemove,
        }),
      } as unknown as ReturnType<typeof createAdminClient>['storage'],
    });

    const result = await runSweep();

    expect(result.expiredRequestsCount).toBe(2);
    expect(result.purgedDocsCount).toBe(1);
    expect(result.expiredSubscriptionsCount).toBe(1);

    // Verificación de guardas TOCTOU
    expect(mockReqUpdateEq).toHaveBeenCalledWith('status', 'published');
    expect(mockOffersUpdateEq).toHaveBeenCalledWith('status', 'pending');
    expect(mockDocUpdateIs).toHaveBeenCalledWith('purged_at', null);
    expect(mockMerchantUpdateEq).toHaveBeenCalledWith('subscription_status', 'active');

    // Verificación de Storage remove
    expect(mockStorageRemove).toHaveBeenCalledWith(['courier-1/dni.jpg']);

    // Verificación de audit_log con target_type en singular y before
    expect(mockAuditInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        target_type: 'delivery_request',
        target_id: 'req-101',
        action: 'expired',
        before: { status: 'published' },
      }),
      expect.objectContaining({
        target_type: 'delivery_request',
        target_id: 'req-102',
        action: 'expired',
        before: { status: 'published' },
      }),
    ]);

    expect(mockAuditInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        target_type: 'courier_document',
        target_id: 'doc-10',
        action: 'purged',
        before: { purged_at: null },
      }),
    ]);

    expect(mockAuditInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        target_type: 'merchant',
        target_id: 'merchant-expired-1',
        action: 'subscription_expired',
        before: { subscription_status: 'active', paid_until: '2026-01-01' },
      }),
    ]);
  });

  it('no actualiza purged_at ni genera audit_log si supabase.storage.remove falla (PR68-H01)', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Supabase Storage unavailable' },
    });
    const mockDocUpdate = vi.fn();
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'courier_documents') {
        return {
          select: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'doc-failed',
                    courier_id: 'courier-2',
                    storage_path: 'courier-2/dni.jpg',
                    purge_after: '2026-08-01T00:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
          update: mockDocUpdate,
        };
      }
      if (table === 'delivery_requests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { value: '0' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'audit_log') {
        return { insert: mockAuditInsert };
      }
      return {};
    });

    setAdminClientMock({
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          remove: mockStorageRemove,
        }),
      } as unknown as ReturnType<typeof createAdminClient>['storage'],
    });

    const result = await runSweep();

    expect(result.purgedDocsCount).toBe(0);
    expect(mockStorageRemove).toHaveBeenCalledWith(['courier-2/dni.jpg']);
    expect(mockDocUpdate).not.toHaveBeenCalled();
    expect(mockAuditInsert).not.toHaveBeenCalled();
  });

  it('no expira comercios a las 22:30 hora de Aguilares (-03:00) si paid_until vence ese mismo día (PR68-H02)', async () => {
    // 2026-09-24T01:30:00.000Z corresponde a 2026-09-23 a las 22:30 en Aguilares (-03:00)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T01:30:00.000Z'));

    const mockMerchantUpdate = vi.fn();

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests' || table === 'courier_documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            lte: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { key: 'subscription_grace_days', value: '0' },
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
                {
                  profile_id: 'merchant-today',
                  paid_until: '2026-09-23',
                  subscription_status: 'active',
                },
              ],
              error: null,
            }),
          }),
          update: mockMerchantUpdate,
        };
      }
      if (table === 'audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    setAdminClientMock({
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      } as unknown as ReturnType<typeof createAdminClient>['storage'],
    });

    const result = await runSweep();
    expect(result.expiredSubscriptionsCount).toBe(0);
    expect(mockMerchantUpdate).not.toHaveBeenCalled();

    // Ahora avanzamos el reloj a las 00:01 del día siguiente en Aguilares (2026-09-24T03:01:00.000Z)
    vi.setSystemTime(new Date('2026-09-24T03:01:00.000Z'));
    mockMerchantUpdate.mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const resultNextDay = await runSweep();
    expect(resultNextDay.expiredSubscriptionsCount).toBe(1);
  });

  it('respeta subscription_grace_days antes de expirar un comercio (PR68-H02 / PR68-H05)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));

    const mockMerchantUpdate = vi.fn();

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests' || table === 'courier_documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            lte: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { key: 'subscription_grace_days', value: '3' },
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
                {
                  profile_id: 'merchant-in-grace',
                  paid_until: '2026-09-22', // venció hace 2 días, pero gracia es 3 días
                  subscription_status: 'active',
                },
              ],
              error: null,
            }),
          }),
          update: mockMerchantUpdate,
        };
      }
      if (table === 'audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    setAdminClientMock({
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      } as unknown as ReturnType<typeof createAdminClient>['storage'],
    });

    const result = await runSweep();
    expect(result.expiredSubscriptionsCount).toBe(0);
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
  });

  it('propaga error si la consulta de delivery_requests falla (PR68-H03)', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Postgres network connection failed' },
              }),
            }),
          }),
        };
      }
      return {};
    });

    setAdminClientMock({
      from: mockFrom,
      storage: {
        from: vi.fn(),
      } as unknown as ReturnType<typeof createAdminClient>['storage'],
    });

    await expect(runSweep()).rejects.toThrow('Failed to fetch expired requests');
  });

  it('propaga error si la consulta de platform_settings falla (PR68-H03 / AG-54)', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'courier_documents') {
        return {
          select: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Settings table lock timeout' },
              }),
            }),
          }),
        };
      }
      return {};
    });

    setAdminClientMock({
      from: mockFrom,
      storage: {
        from: vi.fn(),
      } as unknown as ReturnType<typeof createAdminClient>['storage'],
    });

    await expect(runSweep()).rejects.toThrow('Failed to fetch platform_settings');
  });
});
