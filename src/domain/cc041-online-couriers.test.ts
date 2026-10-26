import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS, adminUpdateSettingInputSchema } from './rpc-contracts';
import { PLATFORM_SETTING_KEYS } from './schemas';
import { createFakeRpcClient, type FakePlatformSettings } from './testing/rpc-fake';

// CC-041 (T-415): presencia de repartidores y conteo de conectados. Los casos siguen al pgTAP
// `supabase/tests/cc041_online_couriers.sql`.

const ADMIN = '00000000-0000-4000-8000-000000410001';
const MERCHANT = '00000000-0000-4000-8000-000000410002';
const COURIER_A = '00000000-0000-4000-8000-000000410004';
const COURIER_B = '00000000-0000-4000-8000-000000410005';
const COURIER_C = '00000000-0000-4000-8000-000000410006';
const COURIER_SUSPENDED = '00000000-0000-4000-8000-000000410007';

const SETTINGS: FakePlatformSettings = {
  minOfferArs: 1000,
  maxOffersPerMin: 100,
  maxRequestPublicationsPerMin: 100,
  maxIncidentsPerMin: 5,
  requestTtlMinutes: 30,
  pilotActive: false,
  pilotTermsVersion: 'v1.0',
  subscriptionGraceDays: 3,
  maxDropsPerRequest: 5,
};

describe('CC-041: contratos', () => {
  it('las dos RPC están registradas con sus errores', () => {
    expect(ALL_RPC_NAMES).toContain('courier_heartbeat');
    expect(ALL_RPC_NAMES).toContain('get_online_couriers_count');
    expect(RPC_CONTRACTS.courier_heartbeat.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'COURIER_NOT_APPROVED',
    ]);
    expect(RPC_CONTRACTS.get_online_couriers_count.errorCodes).toEqual(['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR']);
  });

  it('la salida del conteo es estricta: solo count y windowMinutes', () => {
    const schema = RPC_CONTRACTS.get_online_couriers_count.outputSchema;
    expect(schema.safeParse({ count: 3, windowMinutes: 10 }).success).toBe(true);
    expect(schema.safeParse({ count: -1, windowMinutes: 10 }).success).toBe(false);
    expect(schema.safeParse({ count: 3, windowMinutes: 10, couriers: [] }).success).toBe(false);
  });

  it('la ventana es un parámetro de 2 a 60 minutos', () => {
    expect(PLATFORM_SETTING_KEYS).toContain('courier_online_window_minutes');
    expect(adminUpdateSettingInputSchema.safeParse({ key: 'courier_online_window_minutes', value: 10 }).success).toBe(true);
    for (const value of [1, 61, 2.5]) {
      expect(adminUpdateSettingInputSchema.safeParse({ key: 'courier_online_window_minutes', value }).success).toBe(false);
    }
  });
});

describe('CC-041: el fake se comporta como la base', () => {
  let clock = Date.parse('2026-10-26T12:00:00.000Z');

  function setup() {
    clock = Date.parse('2026-10-26T12:00:00.000Z');
    const fake = createFakeRpcClient({
      settings: SETTINGS,
      now: () => new Date(clock),
      initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2', consentStatus: 'active' },
      initialMerchants: [{ merchantId: MERCHANT, subscriptionStatus: 'active' }],
      initialCouriers: [
        { courierId: COURIER_A, status: 'approved', available: true },
        { courierId: COURIER_B, status: 'approved', available: true },
        { courierId: COURIER_C, status: 'approved', available: false },
        { courierId: COURIER_SUSPENDED, status: 'suspended', available: false },
      ],
    });
    const asCourier = (courierId: string, courierStatus: 'approved' | 'suspended' = 'approved', available = true) =>
      fake.setActor({ userId: courierId, role: 'courier', aal: 'aal1', consentStatus: 'active', courierStatus, courierAvailable: available });
    const asMerchant = () => fake.setActor({ userId: MERCHANT, role: 'merchant', aal: 'aal1', consentStatus: 'active' });
    const count = async () => {
      asMerchant();
      const result = await fake.get_online_couriers_count({});
      if (!result.ok) throw new Error(result.code);
      return result.data;
    };
    return { fake, asCourier, asMerchant, count };
  }

  it('autorización de la señal y del conteo', async () => {
    const t = setup();
    t.asMerchant();
    expect(await t.fake.courier_heartbeat({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    t.asCourier(COURIER_SUSPENDED, 'suspended', false);
    expect(await t.fake.courier_heartbeat({})).toEqual({ ok: false, code: 'COURIER_NOT_APPROVED' });
    t.fake.setActor({ userId: COURIER_A, role: 'courier', aal: 'aal1', consentStatus: 'pending' });
    expect(await t.fake.courier_heartbeat({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    t.asCourier(COURIER_A);
    expect(await t.fake.get_online_couriers_count({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    t.fake.setActor({ userId: MERCHANT, role: 'merchant', aal: 'aal1', consentStatus: 'pending' });
    expect(await t.fake.get_online_couriers_count({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
  });

  it('cuenta aprobados disponibles con señal dentro de la ventana', async () => {
    const t = setup();
    expect(await t.count()).toEqual({ count: 0, windowMinutes: 10 });

    t.asCourier(COURIER_B);
    expect(await t.fake.courier_heartbeat({})).toEqual({ ok: true, data: { lastSeenAt: new Date(clock).toISOString() } });
    clock += 20 * 60 * 1000;
    t.asCourier(COURIER_A);
    await t.fake.courier_heartbeat({});
    t.asCourier(COURIER_C, 'approved', false);
    await t.fake.courier_heartbeat({});

    expect(await t.count()).toEqual({ count: 1, windowMinutes: 10 });

    t.fake.setActor({ userId: ADMIN, role: 'admin', aal: 'aal2', consentStatus: 'active' });
    expect((await t.fake.admin_update_setting({ key: 'courier_online_window_minutes', value: 30 })).ok).toBe(true);
    expect(await t.count()).toEqual({ count: 2, windowMinutes: 30 });

    clock += 31 * 60 * 1000;
    expect(await t.count()).toEqual({ count: 0, windowMinutes: 30 });
  });
});
