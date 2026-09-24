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

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type AdminClientMock = DeepPartial<ReturnType<typeof createAdminClient>>;

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

  it('procesa correctamente expiraciones, purga y suscripciones vencidas con guardas TOCTOU, orden defensivo y audit_log singular (H01-H10)', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

    const mockReqUpdateSelect = vi.fn().mockResolvedValue({
      data: [
        { id: 'req-101', merchant_id: 'merchant-1' },
        { id: 'req-102', merchant_id: 'merchant-2' },
      ],
      error: null,
    });
    const mockReqUpdateLte = vi.fn().mockReturnValue({ select: mockReqUpdateSelect });
    const mockReqUpdateEq = vi.fn().mockReturnValue({ lte: mockReqUpdateLte });
    const mockReqUpdateIn = vi.fn().mockReturnValue({ eq: mockReqUpdateEq });
    const mockReqUpdate = vi.fn().mockReturnValue({ in: mockReqUpdateIn });

    const mockOffersUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockOffersIn = vi.fn().mockReturnValue({ eq: mockOffersUpdateEq });
    const mockOffersUpdate = vi.fn().mockReturnValue({ in: mockOffersIn });

    const mockDocUpdateSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'doc-10' }],
      error: null,
    });
    const mockDocUpdateIs = vi.fn().mockReturnValue({ select: mockDocUpdateSelect });
    const mockDocUpdateIn = vi.fn().mockReturnValue({ is: mockDocUpdateIs });
    const mockDocUpdate = vi.fn().mockReturnValue({ in: mockDocUpdateIn });

    const mockMerchantUpdateSelect = vi.fn().mockResolvedValue({
      data: [{ profile_id: 'merchant-expired-1', paid_until: '2026-01-01' }],
      error: null,
    });
    const mockMerchantUpdateOr = vi.fn().mockReturnValue({ select: mockMerchantUpdateSelect });
    const mockMerchantUpdateEq = vi.fn().mockReturnValue({ or: mockMerchantUpdateOr });
    const mockMerchantIn = vi.fn().mockReturnValue({ eq: mockMerchantUpdateEq });
    const mockMerchantUpdate = vi.fn().mockReturnValue({ in: mockMerchantIn });

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
          update: mockReqUpdate,
        };
      }

      if (table === 'offers') {
        return {
          update: mockOffersUpdate,
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
          update: mockDocUpdate,
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
          update: mockMerchantUpdate,
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
      },
    });

    const result = await runSweep();

    expect(result.expiredRequestsCount).toBe(2);
    expect(result.purgedDocsCount).toBe(1);
    expect(result.expiredSubscriptionsCount).toBe(1);

    // Verificación de payloads de update (matan mutaciones X02, X03, X05, X06)
    expect(mockReqUpdate).toHaveBeenCalledWith({ status: 'expired' });
    expect(mockOffersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired', decided_at: expect.any(String) })
    );
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ purged_at: expect.any(String) })
    );
    expect(mockMerchantUpdate).toHaveBeenCalledWith({ subscription_status: 'expired' });

    // Verificación de ids pasados a .in() (matan mutaciones X04, X09)
    expect(mockOffersIn).toHaveBeenCalledWith('request_id', ['req-101', 'req-102']);
    expect(mockMerchantIn).toHaveBeenCalledWith('profile_id', ['merchant-expired-1']);

    // Verificación de guardas TOCTOU
    expect(mockReqUpdateEq).toHaveBeenCalledWith('status', 'published');
    expect(mockReqUpdateLte).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(mockOffersUpdateEq).toHaveBeenCalledWith('status', 'pending');
    expect(mockDocUpdateIs).toHaveBeenCalledWith('purged_at', null);
    expect(mockMerchantUpdateEq).toHaveBeenCalledWith('subscription_status', 'active');
    expect(mockMerchantUpdateOr).toHaveBeenCalledWith(expect.stringContaining('paid_until.lte.'));

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

  it('falla con 500 (lanza error), no actualiza purged_at ni genera audit_log si supabase.storage.remove falla (PR68-H01)', async () => {
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
      },
    });

    await expect(runSweep()).rejects.toThrow(
      'Failed to purge courier documents from storage: Supabase Storage unavailable'
    );
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
      },
    });

    const result = await runSweep();
    expect(result.expiredSubscriptionsCount).toBe(0);
    expect(mockMerchantUpdate).not.toHaveBeenCalled();

    // Ahora avanzamos el reloj a las 00:01 del día siguiente en Aguilares (2026-09-24T03:01:00.000Z)
    vi.setSystemTime(new Date('2026-09-24T03:01:00.000Z'));
    mockMerchantUpdate.mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ profile_id: 'merchant-today', paid_until: '2026-09-23' }],
              error: null,
            }),
          }),
        }),
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
      },
    });

    const result = await runSweep();
    expect(result.expiredSubscriptionsCount).toBe(0);
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
  });

  it('descarta solicitudes y comercios actualizados concurrentemente (TOCTOU) y no audita ni expira ofertas descartadas (PR68-H03)', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

    // La consulta inicial vio req-101 y req-republished-102
    // Pero el update con guarda lte('expires_at') solo actualiza req-101 (req-republished-102 fue republicado)
    const mockReqUpdateSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'req-101', merchant_id: 'merchant-1' }],
      error: null,
    });
    const mockReqUpdateLte = vi.fn().mockReturnValue({ select: mockReqUpdateSelect });
    const mockReqUpdateEq = vi.fn().mockReturnValue({ lte: mockReqUpdateLte });
    const mockReqUpdateIn = vi.fn().mockReturnValue({ eq: mockReqUpdateEq });
    const mockReqUpdate = vi.fn().mockReturnValue({ in: mockReqUpdateIn });

    const mockOffersUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockOffersIn = vi.fn().mockReturnValue({ eq: mockOffersUpdateEq });
    const mockOffersUpdate = vi.fn().mockReturnValue({ in: mockOffersIn });

    // La consulta vio merchant-1 y merchant-renewed-2
    // Pero el update con guarda or(paid_until.lte...) solo actualiza merchant-1 (merchant-renewed-2 fue renovado)
    const mockMerchantUpdateSelect = vi.fn().mockResolvedValue({
      data: [{ profile_id: 'merchant-1', paid_until: '2026-01-01' }],
      error: null,
    });
    const mockMerchantUpdateOr = vi.fn().mockReturnValue({ select: mockMerchantUpdateSelect });
    const mockMerchantUpdateEq = vi.fn().mockReturnValue({ or: mockMerchantUpdateOr });
    const mockMerchantIn = vi.fn().mockReturnValue({ eq: mockMerchantUpdateEq });
    const mockMerchantUpdate = vi.fn().mockReturnValue({ in: mockMerchantIn });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [
                  { id: 'req-101', merchant_id: 'merchant-1' },
                  { id: 'req-republished-102', merchant_id: 'merchant-2' },
                ],
                error: null,
              }),
            }),
          }),
          update: mockReqUpdate,
        };
      }
      if (table === 'offers') {
        return { update: mockOffersUpdate };
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
                  profile_id: 'merchant-1',
                  paid_until: '2026-01-01',
                  subscription_status: 'active',
                },
                {
                  profile_id: 'merchant-renewed-2',
                  paid_until: '2026-01-01',
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
      },
    });

    const result = await runSweep();

    // Solo se cuenta lo efectivamente actualizado
    expect(result.expiredRequestsCount).toBe(1);
    expect(result.expiredSubscriptionsCount).toBe(1);

    // Las ofertas solo se cancelan para la solicitud efectivamente expirada
    expect(mockOffersIn).toHaveBeenCalledWith('request_id', ['req-101']);
    expect(mockOffersIn).not.toHaveBeenCalledWith(
      'request_id',
      expect.arrayContaining(['req-republished-102'])
    );

    // La auditoría NO incluye la solicitud ni el comercio descartados por la guarda
    expect(mockAuditInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        target_type: 'delivery_request',
        target_id: 'req-101',
      }),
    ]);
    expect(mockAuditInsert).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ target_id: 'req-republished-102' })])
    );

    expect(mockAuditInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        target_type: 'merchant',
        target_id: 'merchant-1',
      }),
    ]);
    expect(mockAuditInsert).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ target_id: 'merchant-renewed-2' })])
    );
  });

  it('asume graceDays = 0 por defecto si platform_settings no tiene la fila y expira comercio vencido (PR68-H10 / X08)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));

    const mockMerchantUpdateSelect = vi.fn().mockResolvedValue({
      data: [{ profile_id: 'merchant-expired-yesterday', paid_until: '2026-09-22' }],
      error: null,
    });
    const mockMerchantUpdate = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            select: mockMerchantUpdateSelect,
          }),
        }),
      }),
    });

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
        // Fila no encontrada (null)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
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
                  profile_id: 'merchant-expired-yesterday',
                  paid_until: '2026-09-22',
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
      },
    });

    const result = await runSweep();
    // Con graceDays = 0 por defecto, 2026-09-22 venció ayer -> expira (count = 1).
    // Si la mutación X08 introduce graceDays = 30 por defecto, no expiraría (count = 0).
    expect(result.expiredSubscriptionsCount).toBe(1);
    expect(mockMerchantUpdate).toHaveBeenCalled();
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
      },
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
      },
    });

    await expect(runSweep()).rejects.toThrow('Failed to fetch platform_settings');
  });

  it('falla y no actualiza courier_documents si el insert de audit_log de la purga falla (D02 / X20)', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockDocUpdate = vi.fn();
    const mockAuditInsert = vi
      .fn()
      .mockImplementation((entries: Array<{ target_type: string }>) => {
        if (entries.some((e) => e.target_type === 'courier_document')) {
          return Promise.resolve({ error: { message: 'Audit log table locked / insert failed' } });
        }
        return Promise.resolve({ error: null });
      });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'courier_documents') {
        return {
          select: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'doc-fail-audit',
                    courier_id: 'courier-audit-fail',
                    storage_path: 'courier-audit-fail/dni.jpg',
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
      },
    });

    await expect(runSweep()).rejects.toThrow(
      'Failed to insert audit_log for purged documents: Audit log table locked / insert failed'
    );
    expect(mockStorageRemove).toHaveBeenCalledWith(['courier-audit-fail/dni.jpg']);
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it('expira comercio justo cuando termina el último día de gracia en Aguilares (-03:00) y calcula el cutoff exacto (H12 / X18)', async () => {
    // 2026-09-24T03:01:00.000Z es 2026-09-24 00:01:00 en Aguilares (-03:00)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T03:01:00.000Z'));

    const mockMerchantUpdateSelect = vi.fn().mockResolvedValue({
      data: [{ profile_id: 'merchant-last-grace-day', paid_until: '2026-09-21' }],
      error: null,
    });
    const mockMerchantUpdateOr = vi.fn().mockImplementation((condition: string) => {
      // Si el cutoff no es 2026-09-21 (por ejemplo X18 que calcula 2026-09-20), no encuentra la fila
      if (!condition.includes('paid_until.lte.2026-09-21')) {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }
      return { select: mockMerchantUpdateSelect };
    });
    const mockMerchantUpdate = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: mockMerchantUpdateOr,
        }),
      }),
    });

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
                  profile_id: 'merchant-last-grace-day',
                  paid_until: '2026-09-21', // con 2 días de gracia venció el 2026-09-23 a las 23:59:59.999 (-03:00)
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
      },
    });

    const result = await runSweep();
    expect(result.expiredSubscriptionsCount).toBe(1);
    expect(mockMerchantUpdateOr).toHaveBeenCalledWith(
      expect.stringContaining('paid_until.lte.2026-09-21')
    );
  });
});
