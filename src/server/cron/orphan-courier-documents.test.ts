// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileOrphanCourierDocuments } from './orphan-courier-documents';
import type { createAdminClient } from '@/server/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

const CLAIM_A = {
  claimId: '30000000-0000-4000-8000-000000000001',
  storagePath: 'courier/00000000-0000-4000-8000-0000000030c1/dni_front_1000.jpg',
};
const CLAIM_B = {
  claimId: '30000000-0000-4000-8000-000000000002',
  storagePath: 'courier/00000000-0000-4000-8000-0000000030c1/selfie_2000.jpg',
};

function claimResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      dryRun: false,
      candidateCount: 0,
      claimed: [],
      skippedLockedCount: 0,
      hasMore: false,
      ...overrides,
    },
    error: null,
  };
}

function completeResponse(completedCount: number, pendingCount: number) {
  return { data: { completedCount, pendingCount }, error: null };
}

function createClient(rpcResponses: ReadonlyArray<unknown>, removeResponse?: unknown) {
  const rpc = vi.fn();
  for (const response of rpcResponses) rpc.mockResolvedValueOnce(response);
  const remove = vi.fn().mockResolvedValue(removeResponse ?? { data: [], error: null });
  const storageFrom = vi.fn().mockReturnValue({ remove });
  const client = { rpc, storage: { from: storageFrom } } as unknown as AdminClient;
  return { client, rpc, remove, storageFrom };
}

describe('reconcileOrphanCourierDocuments (CC-030)', () => {
  let info: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('modo off no toca la base ni Storage', async () => {
    const { client, rpc, storageFrom } = createClient([]);

    const result = await reconcileOrphanCourierDocuments(client, 'off');

    expect(result).toMatchObject({ mode: 'off', candidateCount: 0, claimedCount: 0 });
    expect(rpc).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('dry-run cuenta candidatos sin borrar ni confirmar', async () => {
    const { client, rpc, storageFrom } = createClient([
      claimResponse({ dryRun: true, candidateCount: 3, hasMore: true }),
    ]);

    const result = await reconcileOrphanCourierDocuments(client, 'dry-run');

    expect(rpc).toHaveBeenCalledExactlyOnceWith('claim_orphan_courier_documents', {
      p_limit: 100,
      p_dry_run: true,
    });
    expect(storageFrom).not.toHaveBeenCalled();
    expect(result).toMatchObject({ mode: 'dry-run', candidateCount: 3, claimedCount: 0, removedCount: 0 });
  });

  it('enforce borra sólo lo reclamado en courier-docs y confirma contra la base', async () => {
    const { client, rpc, remove, storageFrom } = createClient(
      [
        claimResponse({ candidateCount: 2, claimed: [CLAIM_A, CLAIM_B] }),
        completeResponse(2, 0),
      ],
      { data: [{ name: CLAIM_A.storagePath }, { name: CLAIM_B.storagePath }], error: null }
    );

    const result = await reconcileOrphanCourierDocuments(client, 'enforce');

    expect(rpc).toHaveBeenNthCalledWith(1, 'claim_orphan_courier_documents', {
      p_limit: 100,
      p_dry_run: false,
    });
    expect(storageFrom).toHaveBeenCalledExactlyOnceWith('courier-docs');
    expect(remove).toHaveBeenCalledExactlyOnceWith([CLAIM_A.storagePath, CLAIM_B.storagePath]);
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_orphan_courier_document_purge');
    expect(result).toEqual({
      mode: 'enforce',
      candidateCount: 2,
      claimedCount: 2,
      removedCount: 2,
      completedCount: 2,
      pendingCount: 0,
      skippedLockedCount: 0,
    });
  });

  it('sin candidatos no llama a Storage pero igual confirma pendientes de corridas anteriores', async () => {
    const { client, rpc, storageFrom } = createClient([claimResponse(), completeResponse(1, 0)]);

    const result = await reconcileOrphanCourierDocuments(client, 'enforce');

    expect(storageFrom).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith('complete_orphan_courier_document_purge');
    expect(result.completedCount).toBe(1);
  });

  it('procesa lotes mientras haya más y corta en el presupuesto de lotes', async () => {
    const { client, rpc, remove } = createClient([
      claimResponse({ candidateCount: 1, claimed: [CLAIM_A], hasMore: true }),
      claimResponse({ candidateCount: 1, claimed: [CLAIM_B], hasMore: true }),
      claimResponse({ candidateCount: 1, claimed: [CLAIM_A], hasMore: true }),
      completeResponse(2, 1),
    ]);

    const result = await reconcileOrphanCourierDocuments(client, 'enforce');

    expect(remove).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(rpc).toHaveBeenLastCalledWith('complete_orphan_courier_document_purge');
    expect(result).toMatchObject({ claimedCount: 3, completedCount: 2, pendingCount: 1 });
  });

  it('si hasMore pero todo está bloqueado, no reintenta en la misma corrida', async () => {
    const { client, rpc } = createClient([
      claimResponse({ candidateCount: 1, skippedLockedCount: 1, hasMore: true }),
      completeResponse(0, 0),
    ]);

    const result = await reconcileOrphanCourierDocuments(client, 'enforce');

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(result.skippedLockedCount).toBe(1);
  });

  it('error de Storage hace fallar sin confirmar: los reclamos quedan para el reintento', async () => {
    const { client, rpc } = createClient(
      [claimResponse({ candidateCount: 1, claimed: [CLAIM_A] })],
      { data: null, error: { message: 'storage unavailable' } }
    );

    await expect(reconcileOrphanCourierDocuments(client, 'enforce')).rejects.toThrow(
      /^Failed to remove orphan courier documents$/
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('reintento tras falla: la siguiente corrida vuelve a borrar el reclamo pendiente y confirma', async () => {
    const failing = createClient(
      [claimResponse({ candidateCount: 1, claimed: [CLAIM_A] })],
      { data: null, error: { message: 'timeout' } }
    );
    await expect(reconcileOrphanCourierDocuments(failing.client, 'enforce')).rejects.toThrow(
      /^Failed to remove orphan courier documents$/
    );

    const retry = createClient(
      [claimResponse({ candidateCount: 1, claimed: [CLAIM_A] }), completeResponse(1, 0)],
      { data: [{ name: CLAIM_A.storagePath }], error: null }
    );
    const result = await reconcileOrphanCourierDocuments(retry.client, 'enforce');

    expect(retry.remove).toHaveBeenCalledExactlyOnceWith([CLAIM_A.storagePath]);
    expect(result).toMatchObject({ removedCount: 1, completedCount: 1, pendingCount: 0 });
  });

  it('error de la RPC de reclamo hace fallar sin tocar Storage', async () => {
    const { client, storageFrom } = createClient([{ data: null, error: { message: 'UNAUTHORIZED_ACTOR' } }]);

    await expect(reconcileOrphanCourierDocuments(client, 'enforce')).rejects.toThrow(
      /^Failed to claim orphan courier documents$/
    );
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it.each([
    ['ruta vacía', { claimed: [{ ...CLAIM_A, storagePath: '' }] }],
    ['claimId inválido', { claimed: [{ ...CLAIM_A, claimId: 'not-a-uuid' }] }],
    ['dryRun distinto del pedido', { dryRun: true }],
    ['candidateCount negativo', { candidateCount: -1 }],
  ])('respuesta inválida de reclamo (%s) falla sin borrar', async (_label, overrides) => {
    const { client, storageFrom } = createClient([claimResponse(overrides)]);

    await expect(reconcileOrphanCourierDocuments(client, 'enforce')).rejects.toThrow(
      'Failed to claim orphan courier documents: invalid RPC response'
    );
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('error o respuesta inválida al confirmar hace fallar el paso', async () => {
    const withError = createClient([claimResponse(), { data: null, error: { message: 'db down' } }]);
    await expect(reconcileOrphanCourierDocuments(withError.client, 'enforce')).rejects.toThrow(
      /^Failed to complete orphan courier document purge$/
    );

    const invalid = createClient([claimResponse(), { data: { completedCount: 'x' }, error: null }]);
    await expect(reconcileOrphanCourierDocuments(invalid.client, 'enforce')).rejects.toThrow(
      'Failed to complete orphan courier document purge: invalid RPC response'
    );
  });

  it('CC-030 H01: ruta huérfana no canónica dentro de courier-docs', async () => {
    const legacyPath = 'legacy/cc030_orphan_old.jpg';
    const { client, rpc, remove, storageFrom } = createClient(
      [
        claimResponse({
          candidateCount: 1,
          claimed: [{ claimId: '30000000-0000-4000-8000-000000000003', storagePath: legacyPath }],
        }),
        completeResponse(1, 0),
      ],
      { data: [{ name: legacyPath }], error: null }
    );

    const result = await reconcileOrphanCourierDocuments(client, 'enforce');

    expect(storageFrom).toHaveBeenCalledExactlyOnceWith('courier-docs');
    expect(remove).toHaveBeenCalledExactlyOnceWith([legacyPath]);
    expect(rpc).toHaveBeenLastCalledWith('complete_orphan_courier_document_purge');
    expect(result).toMatchObject({ claimedCount: 1, removedCount: 1, completedCount: 1, pendingCount: 0 });
  });

  async function captureError(promise: Promise<unknown>): Promise<Error> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof Error) return error;
      throw new Error('Se esperaba una instancia de Error');
    }
    throw new Error('Se esperaba que la reconciliación fallara');
  }

  function expectNoPrivatePath(error: Error, fileName: string) {
    expect(error.message).not.toContain('courier/');
    expect(error.message).not.toContain(fileName);
    expect(error.stack ?? '').not.toContain('courier/');
    expect(error.stack ?? '').not.toContain(fileName);
  }

  it('CC-030 H02: error Storage no filtra rutas privadas', async () => {
    const { client, rpc } = createClient(
      [claimResponse({ candidateCount: 1, claimed: [CLAIM_A] })],
      {
        data: null,
        error: { message: 'storage failure courier/00000000-0000-4000-8000-0000000030c1/dni_front_123.jpg' },
      }
    );

    const error = await captureError(reconcileOrphanCourierDocuments(client, 'enforce'));

    expect(error.message).toBe('Failed to remove orphan courier documents');
    expectNoPrivatePath(error, 'dni_front_123.jpg');
    expect(rpc).not.toHaveBeenCalledWith('complete_orphan_courier_document_purge');
  });

  it('CC-030 H02: error de la RPC de reclamo no filtra rutas privadas', async () => {
    const { client, storageFrom } = createClient([
      {
        data: null,
        error: { message: 'claim failure courier/00000000-0000-4000-8000-0000000030c1/selfie_456.jpg' },
      },
    ]);

    const error = await captureError(reconcileOrphanCourierDocuments(client, 'enforce'));

    expect(error.message).toBe('Failed to claim orphan courier documents');
    expectNoPrivatePath(error, 'selfie_456.jpg');
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('CC-030 H02: error al confirmar la purga no filtra rutas privadas', async () => {
    const { client } = createClient([
      claimResponse(),
      {
        data: null,
        error: { message: 'complete failure courier/00000000-0000-4000-8000-0000000030c1/license_789.jpg' },
      },
    ]);

    const error = await captureError(reconcileOrphanCourierDocuments(client, 'enforce'));

    expect(error.message).toBe('Failed to complete orphan courier document purge');
    expectNoPrivatePath(error, 'license_789.jpg');
  });

  it('las métricas no incluyen rutas ni identificadores', async () => {
    const { client } = createClient(
      [claimResponse({ candidateCount: 1, claimed: [CLAIM_A] }), completeResponse(1, 0)],
      { data: [{ name: CLAIM_A.storagePath }], error: null }
    );

    await reconcileOrphanCourierDocuments(client, 'enforce');

    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain('courier/');
    expect(logged).not.toContain(CLAIM_A.claimId);
  });
});
