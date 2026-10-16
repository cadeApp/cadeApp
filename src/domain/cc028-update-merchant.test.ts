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

const MERCHANT_ID = '10000000-0000-4000-8000-0000000028a1';
const COURIER_ID = '20000000-0000-4000-8000-0000000028c1';
const ZONE_ID = '00000000-0000-4000-8000-000000000001';

function fake() {
  return createFakeRpcClient({
    settings: SETTINGS,
    initialActor: { userId: MERCHANT_ID, role: 'merchant' },
    initialMerchants: [
      {
        merchantId: MERCHANT_ID,
        subscriptionStatus: 'active',
        businessName: 'Comercio Original',
        phone: '3865123456',
        defaultPickupAddress: 'Av. Mitre 100',
        defaultPickupZoneId: ZONE_ID,
        defaultPickupLat: -27.43,
        defaultPickupLng: -65.61,
        notes: 'Timbre planta baja',
      },
    ],
  });
}

describe('CC-028 — update_my_merchant_profile', () => {
  it('está registrada en contratos de RPC con sus códigos de error', () => {
    expect(ALL_RPC_NAMES).toContain('update_my_merchant_profile');
    expect(RPC_CONTRACTS.update_my_merchant_profile.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'VALIDATION_ERROR',
      'OUT_OF_BOUNDS_AGUILARES',
      'NOT_FOUND',
      'INTERNAL_ERROR',
    ]);
  });

  it('inputSchema valida patch y tipos permitidos', () => {
    const schema = RPC_CONTRACTS.update_my_merchant_profile.inputSchema;

    expect(schema.safeParse({ businessName: 'Nuevo Nombre' }).success).toBe(true);
    expect(
      schema.safeParse({
        businessName: 'Nuevo Nombre',
        phone: '3865987654',
        defaultPickupAddress: 'Alberdi 200',
        defaultPickupZoneId: ZONE_ID,
        defaultPickupLat: -27.43,
        defaultPickupLng: -65.61,
        notes: 'Sin timbre',
      }).success
    ).toBe(true);

    // Permite nulls para campos opcionales
    expect(
      schema.safeParse({
        phone: null,
        defaultPickupAddress: null,
        defaultPickupZoneId: null,
        defaultPickupLat: null,
        defaultPickupLng: null,
        notes: null,
      }).success
    ).toBe(true);

    // Rechaza teléfono inválido
    expect(schema.safeParse({ phone: '123' }).success).toBe(false);

    // Rechaza coordenadas asimétricas
    expect(schema.safeParse({ defaultPickupLat: -27.43, defaultPickupLng: null }).success).toBe(false);
    expect(schema.safeParse({ defaultPickupLat: null, defaultPickupLng: -65.61 }).success).toBe(false);

    // Rechaza coordenadas fuera de Aguilares
    expect(schema.safeParse({ defaultPickupLat: -26.0, defaultPickupLng: -65.61 }).success).toBe(false);
  });

  it('outputSchema valida respuesta canónica', () => {
    const schema = RPC_CONTRACTS.update_my_merchant_profile.outputSchema;
    const valid = {
      profileId: MERCHANT_ID,
      businessName: 'Comercio Modificado',
      phone: '3865123456',
      defaultPickupAddress: 'Calle 1',
      defaultPickupZoneId: ZONE_ID,
      defaultPickupLat: -27.43,
      defaultPickupLng: -65.61,
      notes: null,
    };
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('actualiza el perfil del comercio actor en el fake con patch completo', async () => {
    const client = fake();
    const res = await client.update_my_merchant_profile({
      businessName: 'Comercio Editado',
      phone: '3865999888',
      defaultPickupAddress: 'Corrientes 500',
      defaultPickupZoneId: ZONE_ID,
      defaultPickupLat: -27.432,
      defaultPickupLng: -65.615,
      notes: 'Local a la calle',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({
      profileId: MERCHANT_ID,
      businessName: 'Comercio Editado',
      phone: '3865999888',
      defaultPickupAddress: 'Corrientes 500',
      defaultPickupZoneId: ZONE_ID,
      defaultPickupLat: -27.432,
      defaultPickupLng: -65.615,
      notes: 'Local a la calle',
    });
  });

  it('actualiza campos individuales en el fake', async () => {
    const client = fake();

    const r1 = await client.update_my_merchant_profile({ businessName: 'Solo Nombre' });
    expect(r1.ok && r1.data.businessName).toBe('Solo Nombre');

    const r2 = await client.update_my_merchant_profile({ phone: '3865112233' });
    expect(r2.ok && r2.data.phone).toBe('3865112233');

    const r3 = await client.update_my_merchant_profile({ defaultPickupAddress: 'Calle Nueva 123' });
    expect(r3.ok && r3.data.defaultPickupAddress).toBe('Calle Nueva 123');

    const r4 = await client.update_my_merchant_profile({ defaultPickupZoneId: ZONE_ID });
    expect(r4.ok && r4.data.defaultPickupZoneId).toBe(ZONE_ID);

    const r5 = await client.update_my_merchant_profile({
      defaultPickupLat: -27.44,
      defaultPickupLng: -65.6,
    });
    expect(r5.ok && r5.data.defaultPickupLat).toBe(-27.44);
    expect(r5.ok && r5.data.defaultPickupLng).toBe(-65.6);

    const r6 = await client.update_my_merchant_profile({ notes: 'Nueva nota' });
    expect(r6.ok && r6.data.notes).toBe('Nueva nota');
  });

  it('actualiza campos a null en el fake', async () => {
    const client = fake();
    const res = await client.update_my_merchant_profile({
      phone: null,
      defaultPickupAddress: null,
      defaultPickupZoneId: null,
      defaultPickupLat: null,
      defaultPickupLng: null,
      notes: null,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.phone).toBeNull();
    expect(res.data.defaultPickupAddress).toBeNull();
    expect(res.data.defaultPickupZoneId).toBeNull();
    expect(res.data.defaultPickupLat).toBeNull();
    expect(res.data.defaultPickupLng).toBeNull();
    expect(res.data.notes).toBeNull();
  });

  it('rechaza actores no merchant o no autenticados', async () => {
    const client = fake();

    client.setActor({ userId: COURIER_ID, role: 'courier' });
    const courierRes = await client.update_my_merchant_profile({ businessName: 'Test' });
    expect(courierRes).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

    client.setActor({ userId: '', role: null });
    const anonRes = await client.update_my_merchant_profile({ businessName: 'Test' });
    expect(anonRes).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
  });

  it('devuelve NOT_FOUND si el comercio no existe en el fake', async () => {
    const client = fake();
    client.deleteMerchant(MERCHANT_ID);

    const res = await client.update_my_merchant_profile({ businessName: 'Inexistente' });
    expect(res).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it('devuelve VALIDATION_ERROR si la entrada no pasa el schema', async () => {
    const client = fake();
    const res = await client.update_my_merchant_profile({ phone: '123' });
    expect(res).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('soporta setForcedError en el fake', async () => {
    const client = fake();
    client.setForcedError('update_my_merchant_profile', 'INTERNAL_ERROR');

    const res = await client.update_my_merchant_profile({ businessName: 'Falla' });
    expect(res).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });
});
