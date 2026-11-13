import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import { DOMAIN_ERROR_CODES } from './errors';
import {
  type FakePlatformSettings,
  type FakeSeedDocument,
  createFakeRpcClient,
  verifiedRequiredDocuments,
} from './testing/rpc-fake';

// CC-052 (T-437, B-05): contrato y fake de la guarda de documentos y de la subsanación (D5-A, D7-A).
const SETTINGS: FakePlatformSettings = {
  minOfferArs: 1200,
  maxOffersPerMin: 10,
  maxRequestPublicationsPerMin: 10,
  maxIncidentsPerMin: 5,
  requestTtlMinutes: 25,
  pilotActive: true,
  pilotTermsVersion: 'v1.0',
  subscriptionGraceDays: 3,
};

const ADMIN_ID = '30000000-0000-4000-8000-0000000052a1';
const PENDING_ID = '20000000-0000-4000-8000-0000000052c1';
const REJECTED_ID = '20000000-0000-4000-8000-0000000052c2';
const RELEASED_ID = '20000000-0000-4000-8000-0000000052c3';
const KEY_1 = '00000000-0000-4000-8000-000000005201';
const KEY_2 = '00000000-0000-4000-8000-000000005202';
const path = (courierId: string, kind: string, n: number) => `courier/${courierId}/${kind}_${1730000000000 + n}.png`;

function withSelfie(courierId: string, patch: Partial<FakeSeedDocument>): FakeSeedDocument[] {
  return verifiedRequiredDocuments(courierId).map((doc) => (doc.kind === 'selfie' ? { ...doc, ...patch } : doc));
}

function fake(documents: FakeSeedDocument[], actorId: string = ADMIN_ID) {
  return createFakeRpcClient({
    settings: SETTINGS,
    initialActor:
      actorId === ADMIN_ID ? { userId: ADMIN_ID, role: 'admin', aal: 'aal2' } : { userId: actorId, role: 'courier', aal: 'aal1' },
    initialCouriers: [
      { courierId: PENDING_ID, status: 'pending', available: false, vehicleType: 'moto', hasDni: true },
      { courierId: REJECTED_ID, status: 'rejected', available: false, vehicleType: 'moto', hasDni: true },
      { courierId: RELEASED_ID, status: 'rejected', available: false, vehicleType: 'moto', hasDni: false },
    ],
    initialDocuments: documents,
  });
}

describe('CC-052 — contratos', () => {
  it('DOCUMENTS_NOT_VERIFIED es código de dominio y lo declaran las dos RPC del admin', () => {
    expect(DOMAIN_ERROR_CODES).toContain('DOCUMENTS_NOT_VERIFIED');
    expect(RPC_CONTRACTS.admin_decide_courier.errorCodes).toContain('DOCUMENTS_NOT_VERIFIED');
    expect(RPC_CONTRACTS.admin_reinstate_courier.errorCodes).toContain('DOCUMENTS_NOT_VERIFIED');
  });

  it('registra la subsanación con su contrato: solo obligatorios, clave UUID obligatoria y sin vehículo', () => {
    expect(ALL_RPC_NAMES).toContain('resubmit_courier_required_document');
    const contract = RPC_CONTRACTS.resubmit_courier_required_document;
    expect(contract.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ]);
    const base = { kind: 'selfie', storagePath: path(REJECTED_ID, 'selfie', 1), idempotencyKey: KEY_1 };
    expect(contract.inputSchema.safeParse(base).success).toBe(true);
    expect(contract.inputSchema.safeParse({ ...base, kind: 'license' }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ ...base, idempotencyKey: undefined }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ ...base, idempotencyKey: 'no-uuid' }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ ...base, vehicleId: KEY_2 }).success).toBe(false);
  });
});

describe('CC-052 — fake: guarda de aprobar y rehabilitar', () => {
  it('aprueba con los cuatro verificados', async () => {
    const client = fake(verifiedRequiredDocuments(PENDING_ID));
    const result = await client.admin_decide_courier({ courierId: PENDING_ID, decision: 'approved' });
    expect(result.ok).toBe(true);
  });

  it.each([
    ['submitted', { status: 'submitted' as const }],
    ['rejected', { status: 'rejected' as const }],
    ['purgado', { purgedAt: '2026-10-01T00:00:00.000Z' }],
    ['histórico', { isCurrent: false }],
  ])('con la selfie %s aprobar falla y el estado no cambia', async (_label, patch) => {
    const client = fake(withSelfie(PENDING_ID, patch));
    expect(await client.admin_decide_courier({ courierId: PENDING_ID, decision: 'approved' })).toEqual({
      ok: false,
      code: 'DOCUMENTS_NOT_VERIFIED',
    });
    expect(client.getCourier(PENDING_ID)?.status).toBe('pending');
  });

  it('rechazar sigue funcionando con documentos sin verificar', async () => {
    const client = fake(withSelfie(PENDING_ID, { status: 'submitted' }));
    const result = await client.admin_decide_courier({ courierId: PENDING_ID, decision: 'rejected', reason: 'DNI ilegible' });
    expect(result.ok).toBe(true);
  });

  it('rehabilitar falla sin los cuatro verificados y funciona con ellos', async () => {
    const blocked = fake(withSelfie(REJECTED_ID, { status: 'rejected' }));
    expect(await blocked.admin_reinstate_courier({ courierId: REJECTED_ID, reason: 'Revisado' })).toEqual({
      ok: false,
      code: 'DOCUMENTS_NOT_VERIFIED',
    });
    expect(blocked.getCourier(REJECTED_ID)?.status).toBe('rejected');

    const ready = fake(verifiedRequiredDocuments(REJECTED_ID));
    expect((await ready.admin_reinstate_courier({ courierId: REJECTED_ID, reason: 'Revisado' })).ok).toBe(true);
  });
});

describe('CC-052 — fake: subsanación (D5-A)', () => {
  // El actor courier va desde el arranque: setActor con rol courier vuelve a sembrar al repartidor como aprobado.
  const asCourier = (courierId: string, documents: FakeSeedDocument[]) => fake(documents, courierId);

  it('sin vigente inserta; vigente rechazado o purgado reemplaza; no rehabilita', async () => {
    const docs = verifiedRequiredDocuments(REJECTED_ID)
      .filter((d) => d.kind !== 'selfie')
      .map((d) =>
        d.kind === 'dni_front'
          ? { ...d, status: 'rejected' as const }
          : d.kind === 'dni_back'
            ? { ...d, purgedAt: '2026-10-01T00:00:00.000Z' }
            : d
      );
    const client = asCourier(REJECTED_ID, docs);
    const inserted = await client.resubmit_courier_required_document({
      kind: 'selfie',
      storagePath: path(REJECTED_ID, 'selfie', 1),
      idempotencyKey: KEY_1,
    });
    expect(inserted).toEqual({ ok: true, data: expect.objectContaining({ status: 'submitted', replacedDocumentId: null }) });
    for (const kind of ['dni_front', 'dni_back'] as const) {
      const replaced = await client.resubmit_courier_required_document({
        kind,
        storagePath: path(REJECTED_ID, kind, 1),
        idempotencyKey: crypto.randomUUID(),
      });
      expect(replaced.ok && replaced.data.replacedDocumentId).toBeTruthy();
    }
    expect(client.getCourier(REJECTED_ID)?.status).toBe('rejected');
  });

  it('submitted con la misma ruta o la misma clave es idempotente; otra ruta o verificado sin purgar fallan', async () => {
    const client = asCourier(REJECTED_ID, withSelfie(REJECTED_ID, { status: 'rejected' }));
    const first = await client.resubmit_courier_required_document({
      kind: 'selfie',
      storagePath: path(REJECTED_ID, 'selfie', 1),
      idempotencyKey: KEY_1,
    });
    expect(first.ok).toBe(true);
    const sameKey = await client.resubmit_courier_required_document({
      kind: 'selfie',
      storagePath: path(REJECTED_ID, 'selfie', 1),
      idempotencyKey: KEY_1,
    });
    expect(sameKey.ok && sameKey.data.idempotent).toBe(true);
    expect(
      await client.resubmit_courier_required_document({
        kind: 'selfie',
        storagePath: path(REJECTED_ID, 'selfie', 2),
        idempotencyKey: KEY_1,
      })
    ).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(
      await client.resubmit_courier_required_document({
        kind: 'selfie',
        storagePath: path(REJECTED_ID, 'selfie', 2),
        idempotencyKey: KEY_2,
      })
    ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });
    expect(
      await client.resubmit_courier_required_document({
        kind: 'avatar',
        storagePath: path(REJECTED_ID, 'avatar', 1),
        idempotencyKey: crypto.randomUUID(),
      })
    ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });
  });

  it('pending, DNI liberado y ruta ajena no subsanan', async () => {
    const pending = asCourier(PENDING_ID, withSelfie(PENDING_ID, { status: 'rejected' }));
    expect(
      await pending.resubmit_courier_required_document({
        kind: 'selfie',
        storagePath: path(PENDING_ID, 'selfie', 1),
        idempotencyKey: KEY_1,
      })
    ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });

    const released = asCourier(RELEASED_ID, withSelfie(RELEASED_ID, { status: 'rejected' }));
    expect(
      await released.resubmit_courier_required_document({
        kind: 'selfie',
        storagePath: path(RELEASED_ID, 'selfie', 1),
        idempotencyKey: KEY_1,
      })
    ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });

    const rejected = asCourier(REJECTED_ID, withSelfie(REJECTED_ID, { status: 'rejected' }));
    expect(
      await rejected.resubmit_courier_required_document({
        kind: 'selfie',
        storagePath: path(PENDING_ID, 'selfie', 1),
        idempotencyKey: KEY_1,
      })
    ).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('un admin no subsana', async () => {
    const client = fake(withSelfie(REJECTED_ID, { status: 'rejected' }));
    expect(
      await client.resubmit_courier_required_document({
        kind: 'selfie',
        storagePath: path(ADMIN_ID, 'selfie', 1),
        idempotencyKey: KEY_1,
      })
    ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
  });
});
