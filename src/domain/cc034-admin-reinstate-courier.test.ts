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

const ADMIN_ID = '30000000-0000-4000-8000-0000000034a1';
const SUSPENDED_ID = '20000000-0000-4000-8000-0000000034c1';
const REJECTED_ID = '20000000-0000-4000-8000-0000000034c2';
const APPROVED_ID = '20000000-0000-4000-8000-0000000034c3';
const PENDING_ID = '20000000-0000-4000-8000-0000000034c4';
const INCOMPLETE_ID = '20000000-0000-4000-8000-0000000034c5';
const MISSING_ID = '20000000-0000-4000-8000-0000000034c9';

function fake() {
  return createFakeRpcClient({
    settings: SETTINGS,
    initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
    initialCouriers: [
      { courierId: SUSPENDED_ID, status: 'suspended', available: false, vehicleType: 'moto' },
      { courierId: REJECTED_ID, status: 'rejected', available: false, vehicleType: 'bike' },
      { courierId: APPROVED_ID, status: 'approved', available: true, vehicleType: 'car' },
      { courierId: PENDING_ID, status: 'pending', available: false, vehicleType: 'moto' },
      { courierId: INCOMPLETE_ID, status: 'suspended', available: false, vehicleType: null },
    ],
  });
}

describe('CC-034 — admin_reinstate_courier', () => {
  it('está registrada en los contratos con sus códigos de error', () => {
    expect(ALL_RPC_NAMES).toContain('admin_reinstate_courier');
    expect(RPC_CONTRACTS.admin_reinstate_courier.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'NOT_FOUND',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ]);
  });

  it('inputSchema exige courierId uuid y motivo de 1 a 500 caracteres', () => {
    const schema = RPC_CONTRACTS.admin_reinstate_courier.inputSchema;
    expect(schema.safeParse({ courierId: SUSPENDED_ID, reason: 'Revisado' }).success).toBe(true);
    expect(schema.safeParse({ courierId: SUSPENDED_ID, reason: 'x'.repeat(500) }).success).toBe(true);
    expect(schema.safeParse({ courierId: SUSPENDED_ID, reason: 'x'.repeat(501) }).success).toBe(false);
    expect(schema.safeParse({ courierId: SUSPENDED_ID, reason: '   ' }).success).toBe(false);
    expect(schema.safeParse({ courierId: 'no-uuid', reason: 'Revisado' }).success).toBe(false);
  });

  it('outputSchema admite approved como previousStatus solo en la ruta idempotente', () => {
    const schema = RPC_CONTRACTS.admin_reinstate_courier.outputSchema;
    expect(
      schema.safeParse({
        courierId: SUSPENDED_ID,
        previousStatus: 'suspended',
        status: 'approved',
        idempotent: false,
      }).success
    ).toBe(true);
    expect(
      schema.safeParse({
        courierId: APPROVED_ID,
        previousStatus: 'approved',
        status: 'approved',
        idempotent: true,
      }).success
    ).toBe(true);
    expect(
      schema.safeParse({
        courierId: PENDING_ID,
        previousStatus: 'pending',
        status: 'approved',
        idempotent: false,
      }).success
    ).toBe(false);
  });

  it('fake: reactiva un suspendido y reconsidera un rechazado sin disponibilidad', async () => {
    const client = fake();

    const reactivated = await client.admin_reinstate_courier({
      courierId: SUSPENDED_ID,
      reason: 'Aclarado el incidente',
    });
    expect(reactivated).toEqual({
      ok: true,
      data: { courierId: SUSPENDED_ID, previousStatus: 'suspended', status: 'approved', idempotent: false },
    });
    expect(client.getCourier(SUSPENDED_ID)).toMatchObject({ status: 'approved', available: false });

    const reconsidered = await client.admin_reinstate_courier({
      courierId: REJECTED_ID,
      reason: 'Documentación revisada de nuevo',
    });
    expect(reconsidered).toEqual({
      ok: true,
      data: { courierId: REJECTED_ID, previousStatus: 'rejected', status: 'approved', idempotent: false },
    });
    expect(client.getCourier(REJECTED_ID)).toMatchObject({ status: 'approved', available: false });
  });

  it('fake: conserva available tal como estaba (CC-034 no toca la disponibilidad)', async () => {
    const availableRejectedId = '20000000-0000-4000-8000-0000000034c6';
    const client = createFakeRpcClient({
      settings: SETTINGS,
      initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
      initialCouriers: [
        { courierId: availableRejectedId, status: 'rejected', available: true, vehicleType: 'bike' },
      ],
    });
    expect(client.getCourier(availableRejectedId)?.available).toBe(true);

    const result = await client.admin_reinstate_courier({
      courierId: availableRejectedId,
      reason: 'Documentación revisada de nuevo',
    });
    expect(result).toEqual({
      ok: true,
      data: { courierId: availableRejectedId, previousStatus: 'rejected', status: 'approved', idempotent: false },
    });
    expect(client.getCourier(availableRejectedId)?.available).toBe(true);
  });

  it('fake: sobre un aprobado devuelve idempotent true con previousStatus approved', async () => {
    const client = fake();
    const result = await client.admin_reinstate_courier({ courierId: APPROVED_ID, reason: 'Reintento' });
    expect(result).toEqual({
      ok: true,
      data: { courierId: APPROVED_ID, previousStatus: 'approved', status: 'approved', idempotent: true },
    });
    expect(client.getCourier(APPROVED_ID)).toMatchObject({ status: 'approved', available: true });
  });

  it('fake: pending y onboarding incompleto dan INVALID_STATE_TRANSITION sin cambios', async () => {
    const client = fake();
    expect(await client.admin_reinstate_courier({ courierId: PENDING_ID, reason: 'x' })).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(client.getCourier(PENDING_ID)?.status).toBe('pending');

    expect(await client.admin_reinstate_courier({ courierId: INCOMPLETE_ID, reason: 'x' })).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(client.getCourier(INCOMPLETE_ID)?.status).toBe('suspended');
  });

  it('fake: motivo vacío, id inexistente, sin AAL2 y actor no admin', async () => {
    const client = fake();
    expect(await client.admin_reinstate_courier({ courierId: SUSPENDED_ID, reason: '' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(await client.admin_reinstate_courier({ courierId: MISSING_ID, reason: 'x' })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });

    client.setActor({ aal: 'aal1' });
    expect(await client.admin_reinstate_courier({ courierId: SUSPENDED_ID, reason: 'x' })).toEqual({
      ok: false,
      code: 'AAL2_REQUIRED',
    });

    // Un comercio: setActor con rol courier sincroniza el registro del propio repartidor en el fake.
    client.setActor({ userId: '10000000-0000-4000-8000-0000000034b1', role: 'merchant', aal: 'aal1' });
    expect(await client.admin_reinstate_courier({ courierId: SUSPENDED_ID, reason: 'x' })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    expect(client.getCourier(SUSPENDED_ID)?.status).toBe('suspended');
  });
});
