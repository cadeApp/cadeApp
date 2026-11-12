import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import { type FakePlatformSettings, type FakeSeedDocument, createFakeRpcClient } from './testing/rpc-fake';

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

const ADMIN_ID = '30000000-0000-4000-8000-0000000050a1';
const COURIER_A = '20000000-0000-4000-8000-0000000050c1';
const COURIER_B = '20000000-0000-4000-8000-0000000050c2';
const REJECTED_ID = '20000000-0000-4000-8000-0000000050c3';
const SUSPENDED_ID = '20000000-0000-4000-8000-0000000050c4';
const APPROVED_ID = '20000000-0000-4000-8000-0000000050c5';
const PENDING_SUBMITTED_ID = '20000000-0000-4000-8000-0000000050c6';
const CLAIMANT_ID = '20000000-0000-4000-8000-0000000050c7';
const CLAIMANT_NO_DOCS_ID = '20000000-0000-4000-8000-0000000050c8';
const MISSING_ID = '20000000-0000-4000-8000-0000000050c9';

function docsFor(courierId: string, prefix: string): FakeSeedDocument[] {
  return (['dni_front', 'dni_back', 'selfie', 'avatar'] as const).map((kind, i) => ({
    documentId: `${prefix}-0000-4000-8000-00000000000${i}`,
    courierId,
    kind,
    status: 'submitted',
  }));
}

function fake(now: () => Date = () => new Date('2026-11-12T15:00:00.000Z')) {
  return createFakeRpcClient({
    settings: SETTINGS,
    now,
    initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
    initialCouriers: [
      { courierId: COURIER_A, status: 'pending', available: false, vehicleType: null, applicationSubmitted: false },
      { courierId: COURIER_B, status: 'pending', available: false, vehicleType: null, applicationSubmitted: false },
      { courierId: REJECTED_ID, status: 'rejected', available: false, vehicleType: 'bike', hasDni: true },
      { courierId: SUSPENDED_ID, status: 'suspended', available: false, vehicleType: 'moto', hasDni: true },
      { courierId: APPROVED_ID, status: 'approved', available: true, vehicleType: 'car', hasDni: true },
      { courierId: PENDING_SUBMITTED_ID, status: 'pending', available: false, vehicleType: 'moto', hasDni: true },
      {
        courierId: CLAIMANT_ID,
        status: 'pending',
        available: false,
        vehicleType: null,
        applicationSubmitted: false,
        displayName: 'Titular Real',
        phone: '+54 381 555 1234',
      },
      {
        courierId: CLAIMANT_NO_DOCS_ID,
        status: 'pending',
        available: false,
        vehicleType: null,
        applicationSubmitted: false,
        phone: '3815551234',
      },
    ],
    initialDocuments: [...docsFor(CLAIMANT_ID, '50d00001'), ...docsFor(PENDING_SUBMITTED_ID, '50d00002')],
  });
}

describe('CC-050 — contratos', () => {
  it('registra las tres RPC nuevas con sus códigos de error', () => {
    expect(ALL_RPC_NAMES).toEqual(
      expect.arrayContaining([
        'consume_courier_application_attempt',
        'admin_release_courier_dni',
        'admin_find_courier_dispute_candidates',
      ])
    );
    expect(RPC_CONTRACTS.consume_courier_application_attempt.errorCodes).toEqual(['UNAUTHENTICATED', 'RATE_LIMITED']);
    expect(RPC_CONTRACTS.admin_release_courier_dni.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'INVALID_STATE_TRANSITION',
    ]);
    expect(RPC_CONTRACTS.admin_find_courier_dispute_candidates.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
    ]);
    expect(RPC_CONTRACTS.admin_reinstate_courier.errorCodes).toContain('INVALID_STATE_TRANSITION');
  });

  it('consume: entrada vacía estricta y salida null', () => {
    const contract = RPC_CONTRACTS.consume_courier_application_attempt;
    expect(contract.inputSchema.safeParse({}).success).toBe(true);
    expect(contract.inputSchema.safeParse({ courierId: COURIER_A }).success).toBe(false);
    expect(contract.outputSchema.safeParse(null).success).toBe(true);
  });

  it('liberación: motivo de 3 a 500 caracteres tras trim, sin hash ni DNI', () => {
    const schema = RPC_CONTRACTS.admin_release_courier_dni.inputSchema;
    expect(schema.safeParse({ courierId: REJECTED_ID, reason: '  abc  ' }).success).toBe(true);
    expect(schema.safeParse({ courierId: REJECTED_ID, reason: 'y'.repeat(500) }).success).toBe(true);
    expect(schema.safeParse({ courierId: REJECTED_ID, reason: ' ab ' }).success).toBe(false);
    expect(schema.safeParse({ courierId: REJECTED_ID, reason: 'y'.repeat(501) }).success).toBe(false);
    expect(schema.safeParse({ courierId: REJECTED_ID, reason: '      ' }).success).toBe(false);
    expect(schema.safeParse({ courierId: REJECTED_ID, reason: `hash ${'ab'.repeat(32)}` }).success).toBe(false);
    expect(schema.safeParse({ courierId: REJECTED_ID, reason: 'dni 30123456 del titular' }).success).toBe(false);
    expect(schema.safeParse({ courierId: 'no-uuid', reason: 'reclamo' }).success).toBe(false);
    expect(
      RPC_CONTRACTS.admin_release_courier_dni.outputSchema.safeParse({ courierId: REJECTED_ID, released: true }).success
    ).toBe(true);
  });

  it('búsqueda: solo UUID exacto o teléfono completo con caracteres telefónicos', () => {
    const schema = RPC_CONTRACTS.admin_find_courier_dispute_candidates.inputSchema;
    expect(schema.safeParse({ lookup: CLAIMANT_ID }).success).toBe(true);
    expect(schema.safeParse({ lookup: '3815551234' }).success).toBe(true);
    expect(schema.safeParse({ lookup: '+54 (381) 555-1234' }).success).toBe(true);
    for (const lookup of ['', 'juan', '%3815551234', 'foo3815551234', '555 1234', '12345678901234']) {
      expect(schema.safeParse({ lookup }).success, lookup).toBe(false);
    }
  });

  it('búsqueda: la salida es un objeto con candidates (máximo 10), nunca un array en la raíz', () => {
    const schema = RPC_CONTRACTS.admin_find_courier_dispute_candidates.outputSchema;
    const candidate = {
      courierId: CLAIMANT_ID,
      displayName: 'Titular Real',
      phoneMasked: '•••• 1234',
      status: 'pending',
      applicationSubmitted: false,
      documentsCount: 4,
    };
    expect(schema.safeParse({ candidates: [] }).success).toBe(true);
    expect(schema.safeParse({ candidates: [candidate] }).success).toBe(true);
    expect(schema.safeParse([candidate]).success).toBe(false);
    expect(schema.safeParse({ candidates: Array.from({ length: 11 }, () => candidate) }).success).toBe(false);
    expect(schema.safeParse({ candidates: [{ ...candidate, applicationSubmitted: true }] }).success).toBe(false);
  });
});

describe('CC-050 — fake', () => {
  it('consume: 5 por día y por actor; la sexta da RATE_LIMITED; otro actor tiene su cupo', async () => {
    const client = fake();
    client.setActor({ userId: COURIER_A, role: 'courier', aal: 'aal1' });
    for (let i = 0; i < 5; i += 1) {
      expect(await client.consume_courier_application_attempt({})).toEqual({ ok: true, data: null });
    }
    expect(await client.consume_courier_application_attempt({})).toEqual({ ok: false, code: 'RATE_LIMITED' });

    client.setActor({ userId: COURIER_B, role: 'courier', aal: 'aal1' });
    expect(await client.consume_courier_application_attempt({})).toEqual({ ok: true, data: null });
  });

  it('consume: el día es el de Tucumán (UTC-3): a las 02:59 UTC sigue el día anterior y a las 03:00 hay cupo nuevo', async () => {
    let current = new Date('2026-11-13T02:59:00.000Z');
    const client = fake(() => current);
    client.setActor({ userId: COURIER_A, role: 'courier', aal: 'aal1' });
    for (let i = 0; i < 5; i += 1) await client.consume_courier_application_attempt({});
    expect(await client.consume_courier_application_attempt({})).toEqual({ ok: false, code: 'RATE_LIMITED' });

    current = new Date('2026-11-13T03:00:00.000Z');
    expect(await client.consume_courier_application_attempt({})).toEqual({ ok: true, data: null });
  });

  it('liberación: rechazado y suspendido pasan; pendiente y aprobado no; segunda vez no', async () => {
    const client = fake();
    expect(await client.admin_release_courier_dni({ courierId: REJECTED_ID, reason: 'Reclamo verificado' })).toEqual({
      ok: true,
      data: { courierId: REJECTED_ID, released: true },
    });
    expect(client.getCourier(REJECTED_ID)?.hasDni).toBe(false);
    expect(await client.admin_release_courier_dni({ courierId: SUSPENDED_ID, reason: 'Reclamo verificado' })).toEqual({
      ok: true,
      data: { courierId: SUSPENDED_ID, released: true },
    });
    for (const courierId of [PENDING_SUBMITTED_ID, APPROVED_ID, REJECTED_ID]) {
      expect(await client.admin_release_courier_dni({ courierId, reason: 'Reclamo verificado' })).toEqual({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
    }
    expect(await client.admin_release_courier_dni({ courierId: MISSING_ID, reason: 'Reclamo verificado' })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('liberación y búsqueda: admin sin aal2 → AAL2_REQUIRED; repartidor → UNAUTHORIZED_ACTOR', async () => {
    const client = fake();
    client.setActor({ aal: 'aal1' });
    expect(await client.admin_release_courier_dni({ courierId: REJECTED_ID, reason: 'Reclamo' })).toEqual({
      ok: false,
      code: 'AAL2_REQUIRED',
    });
    expect(await client.admin_find_courier_dispute_candidates({ lookup: CLAIMANT_ID })).toEqual({
      ok: false,
      code: 'AAL2_REQUIRED',
    });
    client.setActor({ userId: COURIER_A, role: 'courier', aal: 'aal2' });
    expect(await client.admin_release_courier_dni({ courierId: REJECTED_ID, reason: 'Reclamo' })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
  });

  it('reinstate no reactiva a un repartidor con el DNI liberado', async () => {
    const client = fake();
    await client.admin_release_courier_dni({ courierId: SUSPENDED_ID, reason: 'Reclamo verificado' });
    expect(await client.admin_reinstate_courier({ courierId: SUSPENDED_ID, reason: 'reconsideración' })).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(client.getCourier(SUSPENDED_ID)?.status).toBe('suspended');
  });

  it('búsqueda: encuentra al pendiente sin enviar con documentos por UUID y por teléfono, enmascarado', async () => {
    const client = fake();
    const expected = {
      ok: true,
      data: {
        candidates: [
          {
            courierId: CLAIMANT_ID,
            displayName: 'Titular Real',
            phoneMasked: '•••• 1234',
            status: 'pending',
            applicationSubmitted: false,
            documentsCount: 4,
          },
        ],
      },
    };
    expect(await client.admin_find_courier_dispute_candidates({ lookup: CLAIMANT_ID })).toEqual(expected);
    expect(await client.admin_find_courier_dispute_candidates({ lookup: '+54 (381) 555-1234' })).toEqual(expected);
    expect(await client.admin_find_courier_dispute_candidates({ lookup: PENDING_SUBMITTED_ID })).toEqual({
      ok: true,
      data: { candidates: [] },
    });
    expect(await client.admin_find_courier_dispute_candidates({ lookup: 'foo3815551234' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
  });
});
