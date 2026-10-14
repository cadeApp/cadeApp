import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import { type FakePlatformSettings, createFakeRpcClient } from './testing/rpc-fake';

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

const MERCHANT_A = '10000000-0000-4000-8000-0000000023a1';
const MERCHANT_B = '10000000-0000-4000-8000-0000000023b1';
const COURIER = '20000000-0000-4000-8000-0000000023c1';
const ADMIN = '90000000-0000-4000-8000-0000000023f1';
const REQ_CASH = '30000000-0000-4000-8000-0000000023a1';
const REQ_PLAIN = '30000000-0000-4000-8000-0000000023a2';
const REQ_B = '30000000-0000-4000-8000-0000000023b1';
const REQ_MISSING = '30000000-0000-4000-8000-9999999923ff';

function fake() {
  return createFakeRpcClient({
    settings: SETTINGS,
    initialActor: { userId: MERCHANT_A, role: 'merchant' },
    initialRequests: [
      {
        requestId: REQ_CASH,
        merchantId: MERCHANT_A,
        status: 'published',
        recipientPaymentMethod: 'cash',
        needsChange: true,
        cashChangeAmount: 5000,
        notes: 'Tocar timbre 2B',
      },
      { requestId: REQ_PLAIN, merchantId: MERCHANT_A, status: 'draft' },
      {
        requestId: REQ_B,
        merchantId: MERCHANT_B,
        status: 'published',
        cashChangeAmount: 2000,
        notes: 'Indicaciones ajenas',
      },
    ],
    initialCouriers: [{ courierId: COURIER, status: 'approved', available: true }],
  });
}

describe('CC-023 — get_merchant_request_private_fields', () => {
  it('es parte del contrato de RPC con los códigos de error del CC', () => {
    expect(ALL_RPC_NAMES).toContain('get_merchant_request_private_fields');
    expect(RPC_CONTRACTS.get_merchant_request_private_fields.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ]);
  });

  it('la entrada exige un uuid', () => {
    const schema = RPC_CONTRACTS.get_merchant_request_private_fields.inputSchema;

    expect(schema.safeParse({ requestId: REQ_CASH }).success).toBe(true);
    expect(schema.safeParse({ requestId: 'no-es-uuid' }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('la salida admite solo requestId, notes y cashChangeAmount', () => {
    const schema = RPC_CONTRACTS.get_merchant_request_private_fields.outputSchema;
    const output = { requestId: REQ_CASH, notes: 'Tocar timbre 2B', cashChangeAmount: 5000 };

    expect(schema.safeParse(output).success).toBe(true);
    expect(schema.safeParse({ ...output, notes: null, cashChangeAmount: null }).success).toBe(true);
    expect(schema.safeParse({ ...output, recipientPhone: '3865000000' }).success).toBe(false);
    expect(schema.safeParse({ ...output, cashChangeAmount: 0 }).success).toBe(false);
    expect(schema.safeParse({ ...output, cashChangeAmount: 10.5 }).success).toBe(false);
    expect(schema.safeParse({ requestId: REQ_CASH, notes: null }).success).toBe(false);
  });

  it('el comercio dueño recibe los dos campos, también como null explícito', async () => {
    const client = fake();

    expect(await client.get_merchant_request_private_fields({ requestId: REQ_CASH })).toEqual({
      ok: true,
      data: { requestId: REQ_CASH, notes: 'Tocar timbre 2B', cashChangeAmount: 5000 },
    });
    expect(await client.get_merchant_request_private_fields({ requestId: REQ_PLAIN })).toEqual({
      ok: true,
      data: { requestId: REQ_PLAIN, notes: null, cashChangeAmount: null },
    });
  });

  it('otro comercio no lee la solicitud ajena y la inexistente responde igual', async () => {
    const client = fake();

    expect(await client.get_merchant_request_private_fields({ requestId: REQ_B })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
    expect(await client.get_merchant_request_private_fields({ requestId: REQ_MISSING })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('rechaza repartidor, admin, sesión ausente y comercio sin consentimiento activo', async () => {
    const client = fake();

    client.setActor({ userId: COURIER, role: 'courier' });
    expect(await client.get_merchant_request_private_fields({ requestId: REQ_CASH })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    client.setActor({ userId: ADMIN, role: 'admin', aal: 'aal2' });
    expect(await client.get_merchant_request_private_fields({ requestId: REQ_CASH })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    client.setActor({ userId: '', role: null });
    expect(await client.get_merchant_request_private_fields({ requestId: REQ_CASH })).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
    });

    client.setActor({ userId: MERCHANT_A, role: 'merchant', consentStatus: 'pending' });
    expect(await client.get_merchant_request_private_fields({ requestId: REQ_CASH })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
  });

  it('sigue la precedencia de la función SQL: sesión, entrada, actor y propiedad', async () => {
    const client = fake();
    const invalid = { requestId: 'no-es-uuid' };

    client.setActor({ userId: '', role: null });
    expect(await client.get_merchant_request_private_fields(invalid)).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
    });

    client.setActor({ userId: COURIER, role: 'courier' });
    expect(await client.get_merchant_request_private_fields(invalid)).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    client.setActor({ userId: MERCHANT_A, role: 'merchant', consentStatus: 'pending' });
    expect(await client.get_merchant_request_private_fields({ requestId: REQ_MISSING })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
  });
});
