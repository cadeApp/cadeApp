import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RPC_CONTRACTS, type RpcErrorCode } from '@/domain/rpc-contracts';
import { createFakeRpcClient } from '@/domain/testing/rpc-fake';
import {
  createOffersRpcServerClient,
  mapOfferRpcError,
  setAvailabilityRpc,
  submitOfferRpc,
  withdrawOfferRpc,
  type SupabaseRpcCaller,
} from '@/server/rpc/offers';

const MERCHANT_ID = '00000000-0000-4000-8000-0000000000b1';
const COURIER_1_ID = '00000000-0000-4000-8000-0000000000c1';
const COURIER_2_ID = '00000000-0000-4000-8000-0000000000c2';
const REQ_1_ID = '00000000-0000-4000-8000-000000000101';
const REQ_2_ID = '00000000-0000-4000-8000-000000000102';
const OFFER_1_ID = '00000000-0000-4000-8000-000000000201';
const FIXED_NOW_ISO = '2026-09-23T08:00:00.000Z';

describe('T-101 · RPC de Ofertas (submit_offer, withdraw_offer, set_availability y rate_limits atómico)', () => {
  it('1. DoD Piso dinámico: 999, 1000 y 1001 con min_offer_ars=1000 y luego cambiado a 1500 en el fake y en el wrapper RPC', async () => {
    const fake = createFakeRpcClient({
      settings: {
        minOfferArs: 1000,
        requestTtlMinutes: 30,
        pilotActive: true,
        pilotTermsVersion: 'v1',
        subscriptionGraceDays: 0,
      },
      now: () => new Date(FIXED_NOW_ISO),
      initialActor: {
        userId: COURIER_1_ID,
        role: 'courier',
        courierStatus: 'approved',
        courierAvailable: true,
      },
      initialCouriers: [
        { courierId: COURIER_1_ID, status: 'approved', available: true },
        { courierId: COURIER_2_ID, status: 'approved', available: true },
      ],
      initialRequests: [
        {
          requestId: REQ_1_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T08:30:00.000Z',
        },
        {
          requestId: REQ_2_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T08:30:00.000Z',
        },
      ],
    });

    // Con min_offer_ars = 1000: 999 falla, 1000 y 1001 pasan
    const res999 = await fake.submit_offer({
      requestId: REQ_1_ID,
      amountArs: 999,
      etaMinutes: 15,
    });
    expect(res999).toEqual({ ok: false, code: 'OFFER_BELOW_MINIMUM' });

    const res1000 = await fake.submit_offer({
      requestId: REQ_1_ID,
      amountArs: 1000,
      etaMinutes: 15,
    });
    expect(res1000.ok).toBe(true);

    fake.setActor({ userId: COURIER_2_ID });
    const res1001 = await fake.submit_offer({
      requestId: REQ_1_ID,
      amountArs: 1001,
      etaMinutes: 20,
    });
    expect(res1001.ok).toBe(true);

    // Cambiamos el piso a 1500: 999, 1000, 1001 y 1499 fallan; 1500 pasa
    fake.setMinOfferArs(1500);
    fake.setActor({ userId: COURIER_1_ID });

    for (const amount of [999, 1000, 1001, 1499]) {
      const belowFloor = await fake.submit_offer({
        requestId: REQ_2_ID,
        amountArs: amount,
        etaMinutes: 15,
      });
      expect(belowFloor).toEqual({ ok: false, code: 'OFFER_BELOW_MINIMUM' });
    }

    const res1500 = await fake.submit_offer({
      requestId: REQ_2_ID,
      amountArs: 1500,
      etaMinutes: 15,
    });
    expect(res1500.ok).toBe(true);
  });

  it('2. DoD Estados de repartidor: pending, rejected, suspended y unavailable son rechazados en submit_offer y set_availability', async () => {
    const fake = createFakeRpcClient({
      settings: {
        minOfferArs: 1500,
        requestTtlMinutes: 30,
        pilotActive: true,
        pilotTermsVersion: 'v1',
        subscriptionGraceDays: 0,
      },
      now: () => new Date(FIXED_NOW_ISO),
      initialRequests: [
        {
          requestId: REQ_1_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T08:30:00.000Z',
        },
      ],
    });

    const cases: ReadonlyArray<{
      courierId: string;
      status: 'pending' | 'rejected' | 'suspended' | 'approved';
      available: boolean;
      expectedSubmitCode: RpcErrorCode<'submit_offer'>;
      expectedAvailCode: RpcErrorCode<'set_availability'> | null;
    }> = [
      {
        courierId: '00000000-0000-4000-8000-0000000000d1',
        status: 'pending',
        available: true,
        expectedSubmitCode: 'COURIER_NOT_APPROVED',
        expectedAvailCode: 'COURIER_NOT_APPROVED',
      },
      {
        courierId: '00000000-0000-4000-8000-0000000000d2',
        status: 'rejected',
        available: true,
        expectedSubmitCode: 'COURIER_NOT_APPROVED',
        expectedAvailCode: 'COURIER_NOT_APPROVED',
      },
      {
        courierId: '00000000-0000-4000-8000-0000000000d3',
        status: 'suspended',
        available: true,
        expectedSubmitCode: 'COURIER_SUSPENDED',
        expectedAvailCode: 'COURIER_SUSPENDED',
      },
      {
        courierId: '00000000-0000-4000-8000-0000000000d4',
        status: 'approved',
        available: false,
        expectedSubmitCode: 'COURIER_UNAVAILABLE',
        expectedAvailCode: null,
      },
    ];

    for (const c of cases) {
      fake.seedCourier({ courierId: c.courierId, status: c.status, available: c.available });
      fake.setActor({
        userId: c.courierId,
        role: 'courier',
        courierStatus: c.status,
        courierAvailable: c.available,
      });

      const submitRes = await fake.submit_offer({
        requestId: REQ_1_ID,
        amountArs: 1500,
        etaMinutes: 15,
      });
      expect(submitRes).toEqual({ ok: false, code: c.expectedSubmitCode });

      const availRes = await fake.set_availability({ available: true });
      if (c.expectedAvailCode) {
        expect(availRes).toEqual({ ok: false, code: c.expectedAvailCode });
      } else {
        expect(availRes).toEqual({
          ok: true,
          data: { courierId: c.courierId, available: true },
        });
      }
    }
  });

  it('3. Wrapper src/server/rpc/offers.ts: invoca las RPC de Postgres con los parámetros canónicos y mapea todos los códigos de RPC_CONTRACTS', async () => {
    const rpcSpy = vi.fn();
    const mockClient: SupabaseRpcCaller = {
      rpc: rpcSpy,
    };

    // Caso feliz submit_offer
    rpcSpy.mockResolvedValueOnce({
      data: {
        offerId: OFFER_1_ID,
        requestId: REQ_1_ID,
        status: 'pending',
        amountArs: 1500,
        createdAt: FIXED_NOW_ISO,
      },
      error: null,
    });

    const submitOk = await submitOfferRpc(mockClient, {
      requestId: REQ_1_ID,
      amountArs: 1500,
      etaMinutes: 15,
      message: 'Llego rápido',
    });
    expect(submitOk).toEqual({
      ok: true,
      data: {
        offerId: OFFER_1_ID,
        requestId: REQ_1_ID,
        status: 'pending',
        amountArs: 1500,
        createdAt: FIXED_NOW_ISO,
      },
    });
    expect(rpcSpy).toHaveBeenCalledWith('submit_offer', {
      p_request_id: REQ_1_ID,
      p_amount_ars: 1500,
      p_eta_minutes: 15,
      p_message: 'Llego rápido',
    });

    // Caso feliz withdraw_offer
    rpcSpy.mockResolvedValueOnce({
      data: {
        offerId: OFFER_1_ID,
        status: 'withdrawn',
        decidedAt: FIXED_NOW_ISO,
      },
      error: null,
    });
    const withdrawOk = await withdrawOfferRpc(mockClient, { offerId: OFFER_1_ID });
    expect(withdrawOk).toEqual({
      ok: true,
      data: {
        offerId: OFFER_1_ID,
        status: 'withdrawn',
        decidedAt: FIXED_NOW_ISO,
      },
    });
    expect(rpcSpy).toHaveBeenCalledWith('withdraw_offer', {
      p_offer_id: OFFER_1_ID,
    });

    // Caso feliz set_availability
    rpcSpy.mockResolvedValueOnce({
      data: {
        courierId: COURIER_1_ID,
        available: true,
      },
      error: null,
    });
    const availOk = await setAvailabilityRpc(mockClient, { available: true });
    expect(availOk).toEqual({
      ok: true,
      data: {
        courierId: COURIER_1_ID,
        available: true,
      },
    });
    expect(rpcSpy).toHaveBeenCalledWith('set_availability', {
      p_available: true,
    });

    // Validación de entrada previa en frontera (Zod)
    const invalidSubmit = await submitOfferRpc(mockClient, {
      requestId: 'not-a-uuid',
      amountArs: 1500,
      etaMinutes: 15,
    });
    expect(invalidSubmit).toEqual({ ok: false, code: 'VALIDATION_ERROR' });

    // Mapeo de todos los códigos de error de RPC_CONTRACTS.<rpc>.errorCodes
    for (const code of RPC_CONTRACTS.submit_offer.errorCodes) {
      rpcSpy.mockResolvedValueOnce({
        data: null,
        error: { code: 'P0001', message: code },
      });
      const res = await submitOfferRpc(mockClient, {
        requestId: REQ_1_ID,
        amountArs: 1500,
        etaMinutes: 15,
      });
      expect(res).toEqual({ ok: false, code });
    }

    for (const code of RPC_CONTRACTS.withdraw_offer.errorCodes) {
      rpcSpy.mockResolvedValueOnce({
        data: null,
        error: { code: 'P0001', message: code },
      });
      const res = await withdrawOfferRpc(mockClient, { offerId: OFFER_1_ID });
      expect(res).toEqual({ ok: false, code });
    }

    for (const code of RPC_CONTRACTS.set_availability.errorCodes) {
      rpcSpy.mockResolvedValueOnce({
        data: null,
        error: { code: 'P0001', message: code },
      });
      const res = await setAvailabilityRpc(mockClient, { available: false });
      expect(res).toEqual({ ok: false, code });
    }

    // Adaptador createOffersRpcServerClient (los 3 métodos)
    const bound = createOffersRpcServerClient(mockClient);

    rpcSpy.mockResolvedValueOnce({
      data: {
        offerId: OFFER_1_ID,
        requestId: REQ_1_ID,
        status: 'pending',
        amountArs: 1500,
        createdAt: FIXED_NOW_ISO,
      },
      error: null,
    });
    expect(
      await bound.submit_offer({
        requestId: REQ_1_ID,
        amountArs: 1500,
        etaMinutes: 15,
      })
    ).toEqual({
      ok: true,
      data: {
        offerId: OFFER_1_ID,
        requestId: REQ_1_ID,
        status: 'pending',
        amountArs: 1500,
        createdAt: FIXED_NOW_ISO,
      },
    });

    rpcSpy.mockResolvedValueOnce({
      data: {
        offerId: OFFER_1_ID,
        status: 'withdrawn',
        decidedAt: FIXED_NOW_ISO,
      },
      error: null,
    });
    expect(await bound.withdraw_offer({ offerId: OFFER_1_ID })).toEqual({
      ok: true,
      data: {
        offerId: OFFER_1_ID,
        status: 'withdrawn',
        decidedAt: FIXED_NOW_ISO,
      },
    });

    rpcSpy.mockResolvedValueOnce({
      data: { courierId: COURIER_1_ID, available: false },
      error: null,
    });
    const boundRes = await bound.set_availability({ available: false });
    expect(boundRes).toEqual({
      ok: true,
      data: { courierId: COURIER_1_ID, available: false },
    });

    // Ramas de entrada inválida y salida malformada en los 3 wrappers
    expect(await withdrawOfferRpc(mockClient, { offerId: 'invalid-uuid' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(await setAvailabilityRpc(mockClient, { available: 'nope' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    rpcSpy.mockResolvedValueOnce({ data: { malformed: true }, error: null });
    expect(
      await submitOfferRpc(mockClient, {
        requestId: REQ_1_ID,
        amountArs: 1500,
        etaMinutes: 15,
      })
    ).toEqual({ ok: false, code: 'VALIDATION_ERROR' });

    rpcSpy.mockResolvedValueOnce({ data: { malformed: true }, error: null });
    expect(await withdrawOfferRpc(mockClient, { offerId: OFFER_1_ID })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    rpcSpy.mockResolvedValueOnce({ data: { malformed: true }, error: null });
    expect(await setAvailabilityRpc(mockClient, { available: true })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    // Mapeo de código SQL 23505, 42501, subcadena y fallback desconocido
    expect(
      mapOfferRpcError('submit_offer', {
        code: '23505',
        message: 'duplicate key value violates unique constraint "offers_one_active_per_courier_request_idx"',
      })
    ).toBe('DUPLICATE_ACTIVE_OFFER');
    expect(
      mapOfferRpcError('withdraw_offer', {
        code: '42501',
        message: 'permission denied for function withdraw_offer',
      })
    ).toBe('UNAUTHORIZED_ACTOR');
    expect(
      mapOfferRpcError('submit_offer', {
        code: 'P0001',
        message: 'Postgres error: OFFER_BELOW_MINIMUM details',
      })
    ).toBe('OFFER_BELOW_MINIMUM');
    expect(
      mapOfferRpcError('set_availability', {
        code: 'XX000',
        message: 'unexpected internal error',
      })
    ).toBe('VALIDATION_ERROR');
  });

  it('4. Contrato SQL: la migración de T-101 define SECURITY DEFINER, search_path fijo, FOR UPDATE, rate_limits atómico y solo códigos de RPC_CONTRACTS', () => {
    const migrationsDir = path.resolve('supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.includes('rpc_offers'));
    expect(files.length).toBe(1);

    const sql = fs.readFileSync(path.join(migrationsDir, files[0] ?? ''), 'utf8');
    expect(sql).toMatch(/create or replace function public\.submit_offer/i);
    expect(sql).toMatch(/create or replace function public\.withdraw_offer/i);
    expect(sql).toMatch(/create or replace function public\.set_availability/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = public, pg_temp/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/insert into public\.rate_limits/i);
    expect(sql).toMatch(/on conflict \(subject, action, window_start\)/i);
    expect(sql).toMatch(/min_offer_ars/);

    // Verificar que cada MESSAGE = '...' de P0001 en la migración existe en RPC_CONTRACTS
    const allowedCodes = new Set<string>([
      ...RPC_CONTRACTS.submit_offer.errorCodes,
      ...RPC_CONTRACTS.withdraw_offer.errorCodes,
      ...RPC_CONTRACTS.set_availability.errorCodes,
    ]);
    const raisedCodes = Array.from(sql.matchAll(/message\s*=\s*'([A-Z0-9_]+)'/gi)).map(
      (m) => m[1] ?? ''
    );
    expect(raisedCodes.length).toBeGreaterThanOrEqual(10);
    for (const c of raisedCodes) {
      expect(allowedCodes.has(c), `Código SQL ${c} no figura en RPC_CONTRACTS`).toBe(true);
    }
  });
});
