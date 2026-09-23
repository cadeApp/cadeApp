import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RPC_CONTRACTS, type RpcErrorCode } from '@/domain/rpc-contracts';
import { createFakeRpcClient } from '@/domain/testing/rpc-fake';
import {
  acceptOfferRpc,
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
        maxOffersPerMin: 10,
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
        maxOffersPerMin: 10,
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
    ).toEqual({ ok: false, code: 'INTERNAL_ERROR' });

    rpcSpy.mockResolvedValueOnce({ data: { malformed: true }, error: null });
    expect(await withdrawOfferRpc(mockClient, { offerId: OFFER_1_ID })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    rpcSpy.mockResolvedValueOnce({ data: { malformed: true }, error: null });
    expect(await setAvailabilityRpc(mockClient, { available: true })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    // Mapeo de código SQL 23505, 42501, subcadena y fallback desconocido (INTERNAL_ERROR por D03 / H02)
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
    ).toBe('INTERNAL_ERROR');
  });

  it('4. Contrato SQL por función (H05): cada bloque exige SECURITY DEFINER, search_path, locks y coincidencia bidireccional con RPC_CONTRACTS', () => {
    const migrationsDir = path.resolve('supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.includes('rpc_offers'));
    expect(files.length).toBe(1);

    const sql = fs.readFileSync(path.join(migrationsDir, files[0] ?? ''), 'utf8');
    const seedSql = fs.readFileSync(path.resolve('supabase/seed.sql'), 'utf8');
    expect(seedSql).toMatch(/'max_offers_per_min'/);
    expect(seedSql).toMatch(/'min_offer_ars'/);

    const rawBlocks = sql.split(/create\s+or\s+replace\s+function\s+public\./i).slice(1);
    expect(rawBlocks.length).toBe(3);

    const blockByRpc = new Map<string, string>();
    for (const block of rawBlocks) {
      const fnName = block.match(/^([a-z0-9_]+)\s*\(/i)?.[1];
      if (fnName) {
        blockByRpc.set(fnName, block);
      }
    }

    const expectedRpcs = ['submit_offer', 'withdraw_offer', 'set_availability'] as const;
    expect([...blockByRpc.keys()].sort()).toEqual([...expectedRpcs].sort());

    for (const rpcName of expectedRpcs) {
      const block = blockByRpc.get(rpcName) ?? '';
      expect(block, `${rpcName}: falta SECURITY DEFINER`).toMatch(/security\s+definer/i);
      expect(block, `${rpcName}: falta SET search_path = public, pg_temp`).toMatch(
        /set\s+search_path\s*=\s*public,\s*pg_temp/i
      );
      expect(block, `${rpcName}: falta FOR UPDATE`).toMatch(/for\s+update/i);

      if (rpcName === 'submit_offer') {
        expect(block, 'submit_offer: falta FOR SHARE sobre couriers').toMatch(/for\s+share/i);
        expect(block, 'submit_offer: falta insert en rate_limits').toMatch(
          /insert\s+into\s+public\.rate_limits/i
        );
        expect(block, 'submit_offer: falta ON CONFLICT (subject, action, window_start)').toMatch(
          /on\s+conflict\s*\(\s*subject,\s*action,\s*window_start\s*\)/i
        );
        expect(block, 'submit_offer: falta lectura de min_offer_ars').toMatch(/min_offer_ars/);
        expect(block, 'submit_offer: falta lectura de max_offers_per_min').toMatch(
          /max_offers_per_min/
        );
      }

      if (rpcName === 'withdraw_offer') {
        expect(block, 'withdraw_offer: falta insert en rate_limits').toMatch(
          /insert\s+into\s+public\.rate_limits/i
        );
        expect(block, 'withdraw_offer: falta ON CONFLICT (subject, action, window_start)').toMatch(
          /on\s+conflict\s*\(\s*subject,\s*action,\s*window_start\s*\)/i
        );
        expect(block, 'withdraw_offer: falta lectura de max_offers_per_min').toMatch(
          /max_offers_per_min/
        );
      }

      const raisedInSql = new Set(
        Array.from(block.matchAll(/message\s*=\s*'([A-Z0-9_]+)'/gi)).map((m) => m[1] ?? '')
      );
      const declaredCodes = RPC_CONTRACTS[rpcName].errorCodes;
      expect(
        declaredCodes,
        `${rpcName}: debe declarar INTERNAL_ERROR en RPC_CONTRACTS (D03)`
      ).toContain('INTERNAL_ERROR');

      const declaredSqlCodes = new Set(declaredCodes.filter((c) => c !== 'INTERNAL_ERROR'));
      expect(
        [...raisedInSql].sort(),
        `${rpcName}: discrepancia bidireccional entre códigos levantados en SQL y declarados en RPC_CONTRACTS`
      ).toEqual([...declaredSqlCodes].sort());
    }
  });

  it('5. Precedencia canónica de errores en submit_offer (D05 / H10) y rate limit por ventana en el fake (D06 / H11)', async () => {
    let currentNow = new Date('2026-09-23T05:00:00.000Z');
    const REQ_EXPIRED_ID = '30000000-0000-4000-8000-000000000009';
    const REQ_DRAFT_ID = '30000000-0000-4000-8000-000000000010';
    const REQ_MISSING_ID = '30000000-0000-4000-8000-999999999999';
    const COURIER_SUSPENDED = '20000000-0000-4000-8000-000000000099';

    const fake = createFakeRpcClient({
      now: () => currentNow,
      settings: {
        minOfferArs: 1500,
        maxOffersPerMin: 2,
        requestTtlMinutes: 30,
        pilotActive: true,
        pilotTermsVersion: 'v1',
        subscriptionGraceDays: 0,
      },
      initialActor: {
        userId: COURIER_1_ID,
        role: 'courier',
        courierStatus: 'approved',
        courierAvailable: true,
      },
      initialCouriers: [
        { courierId: COURIER_1_ID, status: 'approved', available: true },
        { courierId: COURIER_SUSPENDED, status: 'suspended', available: false },
      ],
      initialMerchants: [{ merchantId: MERCHANT_ID, subscriptionStatus: 'pilot' }],
      initialRequests: [
        {
          requestId: REQ_1_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T05:30:00.000Z',
        },
        {
          requestId: REQ_2_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T05:30:00.000Z',
        },
        {
          requestId: REQ_EXPIRED_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T04:00:00.000Z',
        },
        {
          requestId: REQ_DRAFT_ID,
          merchantId: MERCHANT_ID,
          status: 'draft',
        },
      ],
    });

    // Tabla de casos H10 (D05): dos problemas simultáneos -> gana la precedencia canónica de la RPC
    // (actor -> repartidor -> parámetros -> piso -> rate limit -> solicitud -> duplicada)
    const dualFaultCases: Array<{
      readonly label: string;
      readonly actorId: string;
      readonly requestId: string;
      readonly amountArs: number;
      readonly expectedCode: string;
    }> = [
      {
        label: 'Monto bajo el piso + solicitud inexistente -> OFFER_BELOW_MINIMUM',
        actorId: COURIER_1_ID,
        requestId: REQ_MISSING_ID,
        amountArs: 1000,
        expectedCode: 'OFFER_BELOW_MINIMUM',
      },
      {
        label: 'Monto bajo el piso + solicitud vencida -> OFFER_BELOW_MINIMUM',
        actorId: COURIER_1_ID,
        requestId: REQ_EXPIRED_ID,
        amountArs: 1000,
        expectedCode: 'OFFER_BELOW_MINIMUM',
      },
      {
        label: 'Monto bajo el piso + solicitud en draft -> OFFER_BELOW_MINIMUM',
        actorId: COURIER_1_ID,
        requestId: REQ_DRAFT_ID,
        amountArs: 1000,
        expectedCode: 'OFFER_BELOW_MINIMUM',
      },
      {
        label: 'Repartidor suspendido + solicitud vencida -> COURIER_SUSPENDED',
        actorId: COURIER_SUSPENDED,
        requestId: REQ_EXPIRED_ID,
        amountArs: 1600,
        expectedCode: 'COURIER_SUSPENDED',
      },
      {
        label: 'Repartidor suspendido + solicitud inexistente -> COURIER_SUSPENDED',
        actorId: COURIER_SUSPENDED,
        requestId: REQ_MISSING_ID,
        amountArs: 1600,
        expectedCode: 'COURIER_SUSPENDED',
      },
    ];

    for (const tc of dualFaultCases) {
      fake.setActor({
        userId: tc.actorId,
        role: 'courier',
        courierStatus: tc.actorId === COURIER_SUSPENDED ? 'suspended' : 'approved',
        courierAvailable: tc.actorId !== COURIER_SUSPENDED,
      });
      const res = await fake.submit_offer({
        requestId: tc.requestId,
        amountArs: tc.amountArs,
        etaMinutes: 15,
      });
      expect(res, tc.label).toEqual({ ok: false, code: tc.expectedCode });
    }

    // D06 / H11 + 6.ª fila de H10: alcanzar el tope de ventana (maxOffersPerMin = 2) con 2 ofertas exitosas
    // y comprobar que la 3.ª llamada ante una solicitud vencida devuelve RATE_LIMITED (antes de REQUEST_EXPIRED)
    fake.setActor({
      userId: COURIER_1_ID,
      role: 'courier',
      courierStatus: 'approved',
      courierAvailable: true,
    });
    expect(
      await fake.submit_offer({ requestId: REQ_1_ID, amountArs: 1500, etaMinutes: 15 })
    ).toEqual({ ok: true, data: expect.objectContaining({ status: 'pending' }) });
    expect(
      await fake.submit_offer({ requestId: REQ_2_ID, amountArs: 1500, etaMinutes: 15 })
    ).toEqual({ ok: true, data: expect.objectContaining({ status: 'pending' }) });

    // 6.ª fila de H10: en el tope (2/2 en la ventana) + solicitud vencida -> RATE_LIMITED
    expect(
      await fake.submit_offer({ requestId: REQ_EXPIRED_ID, amountArs: 1600, etaMinutes: 15 })
    ).toEqual({ ok: false, code: 'RATE_LIMITED' });

    // Al avanzar al minuto siguiente, la ventana se renueva
    currentNow = new Date('2026-09-23T05:01:00.000Z');
    expect(
      await fake.submit_offer({ requestId: REQ_EXPIRED_ID, amountArs: 1600, etaMinutes: 15 })
    ).toEqual({ ok: false, code: 'REQUEST_EXPIRED' });
  });
});

describe('T-102 · RPC accept_offer atómica e idempotente', () => {
  it('6. DoD 10 llamadas concurrentes → una sola ganadora; idempotencia preservando matchedAt; ALREADY_MATCHED; repartidor suspendido entre la oferta y la aceptación', async () => {
    let currentNow = new Date('2026-09-23T10:00:00.000Z');
    const courierUuid = (idx: number) =>
      `00000000-0000-4000-8000-000000000c${String(idx).padStart(2, '0')}`;
    const offerUuid = (idx: number) =>
      `00000000-0000-4000-8000-000000000a${String(idx).padStart(2, '0')}`;

    const couriers10 = Array.from({ length: 10 }, (_, idx) => ({
      courierId: courierUuid(idx + 1),
      status: 'approved' as const,
      available: true,
    }));
    const offers10 = Array.from({ length: 10 }, (_, idx) => ({
      offerId: offerUuid(idx + 1),
      requestId: REQ_1_ID,
      courierId: courierUuid(idx + 1),
      amountArs: 1500 + idx * 50,
      status: 'pending' as const,
    }));
    const firstOfferId = offerUuid(1);
    const offerSuspendedId = offerUuid(11);
    const offerPendingId = offerUuid(12);

    const fake = createFakeRpcClient({
      now: () => currentNow,
      settings: {
        minOfferArs: 1500,
        maxOffersPerMin: 10,
        requestTtlMinutes: 30,
        pilotActive: true,
        pilotTermsVersion: 'v1',
        subscriptionGraceDays: 0,
      },
      initialActor: {
        userId: MERCHANT_ID,
        role: 'merchant',
        merchantSubscriptionStatus: 'pilot',
      },
      initialMerchants: [{ merchantId: MERCHANT_ID, subscriptionStatus: 'pilot' }],
      initialCouriers: [
        ...couriers10,
        // Entre la oferta y la aceptación, el repartidor 11 fue suspendido y el 12 pasó a pending
        { courierId: courierUuid(11), status: 'suspended', available: false },
        { courierId: courierUuid(12), status: 'pending', available: false },
      ],
      initialRequests: [
        {
          requestId: REQ_1_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T10:30:00.000Z',
        },
        {
          requestId: REQ_2_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T10:30:00.000Z',
        },
      ],
      initialOffers: [
        ...offers10,
        {
          offerId: offerSuspendedId,
          requestId: REQ_2_ID,
          courierId: courierUuid(11),
          amountArs: 1600,
          status: 'pending',
        },
        {
          offerId: offerPendingId,
          requestId: REQ_2_ID,
          courierId: courierUuid(12),
          amountArs: 1650,
          status: 'pending',
        },
      ],
    });

    const caller: SupabaseRpcCaller = {
      rpc: vi.fn(async (fn, args) => {
        if (fn === 'accept_offer') {
          const res = await fake.accept_offer({ offerId: String(args.p_offer_id) });
          return res.ok
            ? { data: res.data, error: null }
            : { data: null, error: { code: 'P0001', message: res.code } };
        }
        return { data: null, error: { code: '42883', message: 'Unknown RPC' } };
      }),
    };

    // 1. Repartidor suspendido o no aprobado entre la oferta y la aceptación
    const suspendedRes = await acceptOfferRpc(caller, { offerId: offerSuspendedId });
    expect(suspendedRes).toEqual({ ok: false, code: 'COURIER_SUSPENDED' });

    const pendingCourierRes = await acceptOfferRpc(caller, { offerId: offerPendingId });
    expect(pendingCourierRes).toEqual({ ok: false, code: 'COURIER_NOT_APPROVED' });

    // 2. 10 llamadas concurrentes con Promise.all sobre las 10 ofertas de REQ_1_ID → una sola ganadora y 9 ALREADY_MATCHED
    const raceResults = await Promise.all(
      offers10.map((o) => acceptOfferRpc(caller, { offerId: o.offerId }))
    );

    const winners = raceResults.filter((r) => r.ok);
    const losers = raceResults.filter((r) => !r.ok);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(9);
    expect(winners[0]).toEqual({
      ok: true,
      data: {
        requestId: REQ_1_ID,
        acceptedOfferId: firstOfferId,
        status: 'matched',
        matchedAt: '2026-09-23T10:00:00.000Z',
        idempotent: false,
      },
    });
    for (const loser of losers) {
      expect(loser).toEqual({ ok: false, code: 'ALREADY_MATCHED' });
    }

    // 3. Las 9 ofertas restantes quedaron en rejected en el estado real
    const snapOffers = offers10.map((o) => fake.getOffer(o.offerId));
    expect(snapOffers.filter((o) => o?.status === 'accepted')).toHaveLength(1);
    expect(snapOffers.filter((o) => o?.status === 'rejected')).toHaveLength(9);
    expect(fake.getRequest(REQ_1_ID)?.status).toBe('matched');
    expect(fake.getRequest(REQ_1_ID)?.acceptedOfferId).toBe(firstOfferId);

    // 4. Idempotencia: avanzamos el reloj y volvemos a llamar acceptOfferRpc sobre la oferta ganadora
    currentNow = new Date('2026-09-23T10:05:00.000Z');
    const idempotentRes = await acceptOfferRpc(caller, { offerId: firstOfferId });
    expect(idempotentRes).toEqual({
      ok: true,
      data: {
        requestId: REQ_1_ID,
        acceptedOfferId: firstOfferId,
        status: 'matched',
        matchedAt: '2026-09-23T10:00:00.000Z',
        idempotent: true,
      },
    });

    // 5. Validación de entrada, salida e INTERNAL_ERROR en acceptOfferRpc y createOffersRpcServerClient
    const invalidInput = await acceptOfferRpc(caller, { offerId: 'not-a-uuid' });
    expect(invalidInput).toEqual({ ok: false, code: 'VALIDATION_ERROR' });

    const brokenCaller: SupabaseRpcCaller = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: '57014', message: 'statement timeout' },
      })),
    };
    expect(await acceptOfferRpc(brokenCaller, { offerId: firstOfferId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    const malformedOutputCaller: SupabaseRpcCaller = {
      rpc: vi.fn(async () => ({
        data: { bad: true },
        error: null,
      })),
    };
    expect(await acceptOfferRpc(malformedOutputCaller, { offerId: firstOfferId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    expect(
      mapOfferRpcError('accept_offer', {
        code: '23505',
        message: 'duplicate key value violates unique constraint "idx_offers_one_accepted_per_request"',
      })
    ).toBe('ALREADY_MATCHED');

    const serverClient = createOffersRpcServerClient(caller);
    expect(await serverClient.accept_offer({ offerId: firstOfferId })).toEqual({
      ok: true,
      data: expect.objectContaining({ idempotent: true }),
    });
  });

  it('7. Precedencia canónica de errores en accept_offer ante fallos simultáneos (CC-002)', async () => {
    const OTHER_MERCHANT = '00000000-0000-4000-8000-0000000000b9';
    const COURIER_SUSP = '00000000-0000-4000-8000-000000000c99';
    const REQ_MATCHED = '00000000-0000-4000-8000-000000000901';
    const REQ_EXPIRED = '00000000-0000-4000-8000-000000000902';
    const REQ_CANCELLED = '00000000-0000-4000-8000-000000000903';
    const REQ_PUB = '00000000-0000-4000-8000-000000000904';

    const OFFER_WON = '00000000-0000-4000-8000-000000000911';
    const OFFER_REJECTED_ON_MATCHED = '00000000-0000-4000-8000-000000000912';
    const OFFER_ON_EXPIRED_SUSP = '00000000-0000-4000-8000-000000000913';
    const OFFER_WITHDRAWN_ON_CANCELLED = '00000000-0000-4000-8000-000000000914';
    const OFFER_WITHDRAWN_SUSP_ON_PUB = '00000000-0000-4000-8000-000000000915';

    const fake = createFakeRpcClient({
      now: () => new Date('2026-09-23T12:00:00.000Z'),
      settings: {
        minOfferArs: 1500,
        maxOffersPerMin: 10,
        requestTtlMinutes: 30,
        pilotActive: true,
        pilotTermsVersion: 'v1',
        subscriptionGraceDays: 0,
      },
      initialActor: {
        userId: MERCHANT_ID,
        role: 'merchant',
        merchantSubscriptionStatus: 'pilot',
      },
      initialMerchants: [
        { merchantId: MERCHANT_ID, subscriptionStatus: 'pilot' },
        { merchantId: OTHER_MERCHANT, subscriptionStatus: 'pilot' },
      ],
      initialCouriers: [
        { courierId: COURIER_1_ID, status: 'approved', available: true },
        { courierId: COURIER_SUSP, status: 'suspended', available: false },
      ],
      initialRequests: [
        {
          requestId: REQ_MATCHED,
          merchantId: MERCHANT_ID,
          status: 'matched',
          acceptedOfferId: OFFER_WON,
          matchedAt: '2026-09-23T11:50:00.000Z',
          expiresAt: '2026-09-23T12:30:00.000Z',
        },
        {
          requestId: REQ_EXPIRED,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T11:00:00.000Z',
        },
        {
          requestId: REQ_CANCELLED,
          merchantId: MERCHANT_ID,
          status: 'cancelled',
          expiresAt: '2026-09-23T12:30:00.000Z',
        },
        {
          requestId: REQ_PUB,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-23T12:30:00.000Z',
        },
      ],
      initialOffers: [
        {
          offerId: OFFER_WON,
          requestId: REQ_MATCHED,
          courierId: COURIER_SUSP,
          amountArs: 1500,
          status: 'accepted',
        },
        {
          offerId: OFFER_REJECTED_ON_MATCHED,
          requestId: REQ_MATCHED,
          courierId: COURIER_SUSP,
          amountArs: 1600,
          status: 'rejected',
        },
        {
          offerId: OFFER_ON_EXPIRED_SUSP,
          requestId: REQ_EXPIRED,
          courierId: COURIER_SUSP,
          amountArs: 1600,
          status: 'pending',
        },
        {
          offerId: OFFER_WITHDRAWN_ON_CANCELLED,
          requestId: REQ_CANCELLED,
          courierId: COURIER_SUSP,
          amountArs: 1600,
          status: 'withdrawn',
        },
        {
          offerId: OFFER_WITHDRAWN_SUSP_ON_PUB,
          requestId: REQ_PUB,
          courierId: COURIER_SUSP,
          amountArs: 1600,
          status: 'withdrawn',
        },
      ],
    });

    // 1. Comercio ajeno + solicitud matched -> UNAUTHORIZED_ACTOR (paso 4 precede a paso 5)
    fake.setActor({ userId: OTHER_MERCHANT, role: 'merchant' });
    expect(await fake.accept_offer({ offerId: OFFER_REJECTED_ON_MATCHED })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    // 2. Idempotencia sobre oferta ganadora + repartidor suspendido luego del match -> ok idempotent: true (paso 5 precede a paso 8)
    fake.setActor({ userId: MERCHANT_ID, role: 'merchant' });
    expect(await fake.accept_offer({ offerId: OFFER_WON })).toEqual({
      ok: true,
      data: expect.objectContaining({ idempotent: true, matchedAt: '2026-09-23T11:50:00.000Z' }),
    });

    // 3. Solicitud matched con otra oferta + oferta rejected -> ALREADY_MATCHED (paso 5 precede a paso 7 OFFER_NOT_PENDING)
    expect(await fake.accept_offer({ offerId: OFFER_REJECTED_ON_MATCHED })).toEqual({
      ok: false,
      code: 'ALREADY_MATCHED',
    });

    // 4. Solicitud vencida + repartidor suspendido -> REQUEST_EXPIRED (paso 6 precede a paso 8)
    expect(await fake.accept_offer({ offerId: OFFER_ON_EXPIRED_SUSP })).toEqual({
      ok: false,
      code: 'REQUEST_EXPIRED',
    });

    // 5. Solicitud cancelada + oferta withdrawn -> INVALID_STATE_TRANSITION (paso 6 precede a paso 7)
    expect(await fake.accept_offer({ offerId: OFFER_WITHDRAWN_ON_CANCELLED })).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });

    // 6. Oferta withdrawn + repartidor suspendido en solicitud publicada -> OFFER_NOT_PENDING (paso 7 precede a paso 8)
    expect(await fake.accept_offer({ offerId: OFFER_WITHDRAWN_SUSP_ON_PUB })).toEqual({
      ok: false,
      code: 'OFFER_NOT_PENDING',
    });
  });

  it('8. Contrato SQL de accept_offer: SECURITY DEFINER, search_path, locks FOR UPDATE/FOR SHARE, drop policy offers_update_merchant y coincidencia bidireccional de códigos', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260923170000_rpc_accept_offer_v1.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+offers_update_merchant\s+on\s+public\.offers/i);

    const blocks = sql.split(/create\s+or\s+replace\s+function\s+public\./i).slice(1);
    const acceptBlock = blocks.find((b) => b.trimStart().startsWith('accept_offer('));
    expect(acceptBlock, 'Falta la función public.accept_offer en la migración').toBeDefined();

    const body = acceptBlock ?? '';
    expect(body).toMatch(/security\s+definer/i);
    expect(body).toMatch(/set\s+search_path\s*=\s*public\s*,\s*pg_temp/i);
    expect(body).toMatch(/from\s+public\.delivery_requests[\s\S]*?for\s+update/i);
    expect(body).toMatch(/from\s+public\.offers[\s\S]*?for\s+update/i);
    expect(body).toMatch(/from\s+public\.couriers[\s\S]*?for\s+share/i);

    const raisedCodes = Array.from(body.matchAll(/raise\s+exception\s+'([A-Z0-9_]+)'/gi)).map(
      (m) => m[1] as RpcErrorCode<'accept_offer'>
    );
    const uniqueRaised = Array.from(new Set(raisedCodes)).sort();
    const expectedContractCodes = RPC_CONTRACTS.accept_offer.errorCodes
      .filter((c) => c !== 'INTERNAL_ERROR')
      .slice()
      .sort();

    expect(uniqueRaised).toEqual(expectedContractCodes);
  });
});

