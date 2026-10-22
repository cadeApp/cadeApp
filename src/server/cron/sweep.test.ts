// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runSweep } from './sweep';
import { reconcileOrphanCourierDocuments } from './orphan-courier-documents';
import { createAdminClient } from '@/server/supabase/admin';

vi.mock('@/server/env', () => ({
  serverEnv: {
    CRON_SECRET: 'test-cron-secret-12345',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    COURIER_DOCS_ORPHAN_PURGE_MODE: 'enforce',
  },
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

// CC-030: el paso de huérfanos tiene su propia suite (orphan-courier-documents.test.ts).
vi.mock('./orphan-courier-documents', () => ({
  reconcileOrphanCourierDocuments: vi.fn().mockResolvedValue({
    mode: 'enforce',
    candidateCount: 0,
    claimedCount: 0,
    removedCount: 0,
    completedCount: 0,
    pendingCount: 0,
    skippedLockedCount: 0,
  }),
}));

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type AdminClientMock = DeepPartial<ReturnType<typeof createAdminClient>>;

function setAdminClientMock(mock: AdminClientMock) {
  vi.mocked(createAdminClient).mockReturnValue({
    rpc: vi.fn().mockResolvedValue({
      data: {
        expiredRequestIds: [],
        expiredOfferCourierIdsByRequest: {},
        expiredCount: 0,
        hasMore: false,
      },
      error: null,
    }),
    ...mock,
  } as ReturnType<typeof createAdminClient>);
}

function reconciliationBatch(batch: number, count: number, hasMore: boolean) {
  const expiredRequestIds = Array.from(
    { length: count },
    (_, index) => `40000000-0000-4000-8000-${String(batch * 1_000 + index + 1).padStart(12, '0')}`
  );

  return {
    data: {
      expiredRequestIds,
      expiredOfferCourierIdsByRequest: {},
      expiredCount: count,
      hasMore,
    },
    error: null,
  };
}

function setSweepBatches(batches: ReadonlyArray<ReturnType<typeof reconciliationBatch>>) {
  const rpc = vi.fn();
  for (const batch of batches) rpc.mockResolvedValueOnce(batch);

  const deliveryRequestsIn = vi.fn().mockImplementation((_column: string, requestIds: readonly string[]) =>
    Promise.resolve({
      data: requestIds.map((id, index) => ({
        id,
        merchant_id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      })),
      error: null,
    })
  );
  const courierDocumentsSelect = vi.fn().mockReturnValue({
    lte: vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  });
  const merchantsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  });

  setAdminClientMock({
    rpc,
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests') {
        return {
          select: vi.fn().mockReturnValue({ in: deliveryRequestsIn }),
        };
      }
      if (table === 'courier_documents') return { select: courierDocumentsSelect };
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { value: '0' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'merchants') return { select: merchantsSelect };
      return {};
    }),
    storage: { from: vi.fn() },
  });

  return { courierDocumentsSelect, deliveryRequestsIn, merchantsSelect, rpc };
}

describe('runSweep logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CC-030 ejecuta la reconciliación de huérfanos con el modo del entorno y la informa', async () => {
    setSweepBatches([reconciliationBatch(1, 0, false)]);

    const result = await runSweep();

    expect(reconcileOrphanCourierDocuments).toHaveBeenCalledExactlyOnceWith(
      vi.mocked(createAdminClient).mock.results[0]?.value,
      'enforce'
    );
    expect(result.orphanCourierDocuments).toMatchObject({ mode: 'enforce', claimedCount: 0 });
  });

  it('CC-030 una falla de huérfanos hace fallar el sweep después de los pasos previos', async () => {
    const { merchantsSelect } = setSweepBatches([reconciliationBatch(1, 0, false)]);
    vi.mocked(reconcileOrphanCourierDocuments).mockRejectedValueOnce(
      new Error('Failed to remove orphan courier documents: boom')
    );

    await expect(runSweep()).rejects.toThrow('Failed to remove orphan courier documents');
    expect(merchantsSelect).toHaveBeenCalledTimes(1);
  });

  it('CC-026 no abandona la segunda página cuando la RPC devuelve 200 cambios y luego 1', async () => {
    const { courierDocumentsSelect, deliveryRequestsIn, merchantsSelect, rpc } = setSweepBatches([
      reconciliationBatch(1, 200, true),
      reconciliationBatch(2, 1, false),
    ]);
    const push = await import('@/server/push');
    const notify = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
      totalSubscriptions: 0,
      sentCount: 0,
      failedCount: 0,
      deletedSubscriptions: [],
      attempts: [],
      errors: [],
    });

    try {
      await expect(runSweep()).resolves.toMatchObject({ expiredRequestsCount: 201 });
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc).toHaveBeenNthCalledWith(1, 'reconcile_expired_requests_cron', { p_limit: 200 });
      expect(rpc).toHaveBeenNthCalledWith(2, 'reconcile_expired_requests_cron', { p_limit: 200 });
      expect(deliveryRequestsIn).toHaveBeenCalledTimes(2);
      expect(notify).toHaveBeenCalledTimes(201);
      expect(new Set(notify.mock.calls.map(([, payload]) => payload.requestId)).size).toBe(201);
      expect(courierDocumentsSelect).toHaveBeenCalledTimes(1);
      expect(merchantsSelect).toHaveBeenCalledTimes(1);
    } finally {
      notify.mockRestore();
    }
  });

  it('CC-026 agota tres lotes con cambios antes de purgar documentos y suscripciones una sola vez', async () => {
    const { courierDocumentsSelect, deliveryRequestsIn, merchantsSelect, rpc } = setSweepBatches([
      reconciliationBatch(1, 200, true),
      reconciliationBatch(2, 200, true),
      reconciliationBatch(3, 1, false),
    ]);
    const push = await import('@/server/push');
    const notify = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
      totalSubscriptions: 0,
      sentCount: 0,
      failedCount: 0,
      deletedSubscriptions: [],
      attempts: [],
      errors: [],
    });

    try {
      await expect(runSweep()).resolves.toMatchObject({ expiredRequestsCount: 401 });
      expect(rpc).toHaveBeenCalledTimes(3);
      expect(deliveryRequestsIn).toHaveBeenCalledTimes(3);
      expect(notify).toHaveBeenCalledTimes(401);
      expect(new Set(notify.mock.calls.map(([, payload]) => payload.requestId)).size).toBe(401);
      expect(courierDocumentsSelect).toHaveBeenCalledTimes(1);
      expect(merchantsSelect).toHaveBeenCalledTimes(1);
    } finally {
      notify.mockRestore();
    }
  });

  it('CC-026 no reintenta indefinidamente un lote solo bloqueado', async () => {
    const { courierDocumentsSelect, deliveryRequestsIn, merchantsSelect, rpc } = setSweepBatches([
      reconciliationBatch(1, 0, true),
    ]);
    const push = await import('@/server/push');
    const notify = vi.spyOn(push, 'safeNotifyPostTransition');

    try {
      await expect(runSweep()).resolves.toMatchObject({ expiredRequestsCount: 0 });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(deliveryRequestsIn).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      expect(courierDocumentsSelect).toHaveBeenCalledTimes(1);
      expect(merchantsSelect).toHaveBeenCalledTimes(1);
    } finally {
      notify.mockRestore();
    }
  });

  it('procesa correctamente expiraciones, purga y suscripciones vencidas con guardas TOCTOU, orden defensivo y audit_log singular (H01-H10)', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });
    const reconciliationRpc = vi.fn().mockResolvedValue({
      data: {
        expiredRequestIds: ['req-101', 'req-102'],
        expiredOfferCourierIdsByRequest: {},
        expiredCount: 2,
        hasMore: false,
      },
      error: null,
    });

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
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
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
      rpc: reconciliationRpc,
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

    expect(reconciliationRpc).toHaveBeenCalledExactlyOnceWith('reconcile_expired_requests_cron', {
      p_limit: 200,
    });
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ purged_at: expect.any(String) })
    );
    expect(mockMerchantUpdate).toHaveBeenCalledWith({ subscription_status: 'expired' });

    expect(mockMerchantIn).toHaveBeenCalledWith('profile_id', ['merchant-expired-1']);

    // Verificación de guardas TOCTOU que permanecen fuera de la transacción de expiración.
    expect(mockDocUpdateIs).toHaveBeenCalledWith('purged_at', null);
    expect(mockMerchantUpdateEq).toHaveBeenCalledWith('subscription_status', 'active');
    expect(mockMerchantUpdateOr).toHaveBeenCalledWith(expect.stringContaining('paid_until.lte.'));

    // Verificación de Storage remove
    expect(mockStorageRemove).toHaveBeenCalledWith(['courier-1/dni.jpg']);

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

  it('conserva la guarda de suscripciones y delega la guarda de expiraciones atómica a la RPC (PR68-H03)', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });
    const reconciliationRpc = vi.fn().mockResolvedValue({
      data: {
        expiredRequestIds: ['req-101'],
        expiredOfferCourierIdsByRequest: {},
        expiredCount: 1,
        hasMore: false,
      },
      error: null,
    });

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
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
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
      rpc: reconciliationRpc,
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

    expect(reconciliationRpc).toHaveBeenCalledExactlyOnceWith('reconcile_expired_requests_cron', {
      p_limit: 200,
    });

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

  it('propaga error si la RPC transaccional de expiraciones falla (CC-026)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Postgres network connection failed' },
    });
    setAdminClientMock({
      rpc,
      from: vi.fn(),
      storage: {
        from: vi.fn(),
      },
    });

    await expect(runSweep()).rejects.toThrow(
      'Failed to reconcile expired requests: Postgres network connection failed'
    );
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

  describe('T-206: Cableado de push en transiciones de negocio (sweep / request_expired)', () => {
    it('CC-026 reconcilia mediante la RPC transaccional y notifica solo destinatarios retornados post-commit', async () => {
      const requestId = '10300000-0000-4000-8000-000000000050';
      const merchantId = '10300000-0000-4000-8000-000000000051';
      const courierId = '10300000-0000-4000-8000-000000000052';
      const rpc = vi.fn().mockResolvedValue({
        data: {
          expiredRequestIds: [requestId],
          expiredOfferCourierIdsByRequest: { [requestId]: [courierId] },
          expiredCount: 1,
          hasMore: false,
        },
        error: null,
      });
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
        totalSubscriptions: 2,
        sentCount: 2,
        failedCount: 0,
        deletedSubscriptions: [],
        attempts: [],
        errors: [],
      });
      const deliveryRequestsSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [{ id: requestId, merchant_id: merchantId }], error: null }),
      });
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return { select: deliveryRequestsSelect };
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
        return {};
      });

      setAdminClientMock({
        rpc,
        from: mockFrom,
        storage: { from: vi.fn() },
      });

      await expect(runSweep()).resolves.toMatchObject({ expiredRequestsCount: 1 });
      expect(rpc).toHaveBeenCalledExactlyOnceWith('reconcile_expired_requests_cron', {
        p_limit: 200,
      });
      expect(safeNotifySpy).toHaveBeenCalledExactlyOnceWith(
        expect.arrayContaining([merchantId, courierId]),
        { event: 'request_expired', requestId }
      );
      safeNotifySpy.mockRestore();
    });

    it('despacha request_expired a comercio y repartidores con ofertas cuando expira una solicitud', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
        totalSubscriptions: 2,
        sentCount: 2,
        failedCount: 0,
        deletedSubscriptions: [],
        attempts: [],
        errors: [],
      });

      const reconciliationRpc = vi.fn().mockResolvedValue({
        data: {
          expiredRequestIds: ['req-expired-10', 'req-expired-20'],
          expiredOfferCourierIdsByRequest: {
            'req-expired-10': ['courier-with-offer-1'],
            'req-expired-20': ['courier-with-offer-2'],
          },
          expiredCount: 2,
          hasMore: false,
        },
        error: null,
      });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'req-expired-10', merchant_id: 'merchant-expired-10' },
                  { id: 'req-expired-20', merchant_id: 'merchant-expired-20' },
                ],
                error: null,
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
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      setAdminClientMock({
        rpc: reconciliationRpc,
        from: mockFrom,
        storage: {
          from: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      });

      const result = await runSweep();

      expect(result.expiredRequestsCount).toBe(2);
      expect(reconciliationRpc).toHaveBeenCalledExactlyOnceWith('reconcile_expired_requests_cron', {
        p_limit: 200,
      });

      expect(safeNotifySpy).toHaveBeenCalledTimes(2);

      const [call1Recipients, call1Payload] = safeNotifySpy.mock.calls[0]!;
      expect(call1Recipients).toHaveLength(2);
      expect(new Set(call1Recipients)).toEqual(new Set(['merchant-expired-10', 'courier-with-offer-1']));
      expect(call1Payload).toEqual({
        event: 'request_expired',
        requestId: 'req-expired-10',
      });

      const [call2Recipients, call2Payload] = safeNotifySpy.mock.calls[1]!;
      expect(call2Recipients).toHaveLength(2);
      expect(new Set(call2Recipients)).toEqual(new Set(['merchant-expired-20', 'courier-with-offer-2']));
      expect(call2Payload).toEqual({
        event: 'request_expired',
        requestId: 'req-expired-20',
      });
      safeNotifySpy.mockRestore();
    });

    it('runSweep conserva resultado exitoso si push falla (best-effort)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockRejectedValue(
        new Error('Push notification transport error')
      );

      const reconciliationRpc = vi.fn().mockResolvedValue({
        data: {
          expiredRequestIds: ['req-expired-20'],
          expiredOfferCourierIdsByRequest: { 'req-expired-20': ['courier-with-offer-2'] },
          expiredCount: 1,
          hasMore: false,
        },
        error: null,
      });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'req-expired-20', merchant_id: 'merchant-expired-20' }],
                error: null,
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
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      setAdminClientMock({
        rpc: reconciliationRpc,
        from: mockFrom,
        storage: {
          from: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      });

      const result = await runSweep();
      expect(result.expiredRequestsCount).toBe(1);
      safeNotifySpy.mockRestore();
    });

    it('runSweep NO llama a push si ninguna solicitud expira', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

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
      expect(result.expiredRequestsCount).toBe(0);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });
  });
});

