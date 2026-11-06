import { describe, expect, it } from 'vitest';
import { ALL_DOMAIN_ERROR_CODES, ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import { createFakeRpcClient, type FakePlatformSettings } from './testing/rpc-fake';

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

const COURIER_ID = '20000000-0000-4000-8000-0000000042c1';
const MERCHANT_ID = '10000000-0000-4000-8000-0000000042b1';
const NOW = new Date('2026-11-06T12:00:00.000Z');

function vehiclesClient(options?: {
  readonly status?: 'pending' | 'approved' | 'rejected' | 'suspended';
  readonly applicationSubmitted?: boolean;
  readonly consentStatus?: 'active' | 'reconsent_required';
}) {
  return createFakeRpcClient({
    settings: SETTINGS,
    now: () => NOW,
    initialActor: {
      userId: COURIER_ID,
      role: 'courier',
      consentStatus: options?.consentStatus ?? 'active',
      aal: 'aal1',
    },
    initialCouriers: [
      {
        courierId: COURIER_ID,
        status: options?.status ?? 'approved',
        available: true,
        vehicleType: 'moto',
        vehiclePlate: 'AB 123 CD',
        licenseStatus: 'verified',
        insuranceStatus: 'verified',
        applicationSubmitted: options?.applicationSubmitted ?? true,
      },
    ],
  });
}

async function vehicleIds(client: ReturnType<typeof vehiclesClient>) {
  const listed = await client.get_my_courier_vehicles({});
  if (!listed.ok) throw new Error(listed.code);
  return listed.data;
}

describe('CC-042 — contrato de vehículos del repartidor', () => {
  it('registra las 5 RPC de vehículos y los errores nuevos con su mensaje', () => {
    for (const name of [
      'get_my_courier_vehicles',
      'add_courier_vehicle',
      'update_courier_vehicle',
      'remove_courier_vehicle',
      'set_active_courier_vehicle',
    ] as const) {
      expect(ALL_RPC_NAMES).toContain(name);
      expect(RPC_CONTRACTS).toHaveProperty(name);
    }
    expect(ALL_DOMAIN_ERROR_CODES).toContain('VEHICLE_SWITCH_BLOCKED');
    expect(ALL_DOMAIN_ERROR_CODES).toContain('DUPLICATE_VEHICLE');
    expect(RPC_CONTRACTS.set_active_courier_vehicle.errorCodes).toContain('VEHICLE_SWITCH_BLOCKED');
    expect(RPC_CONTRACTS.add_courier_vehicle.errorCodes).toContain('DUPLICATE_VEHICLE');
  });

  it('las RPC de documentos aceptan el vehículo como opcional', () => {
    const vehicleId = '30000000-0000-4000-8000-000000000042';
    expect(
      RPC_CONTRACTS.add_courier_optional_document.inputSchema.safeParse({
        kind: 'license',
        storagePath: 'courier/x/license_1.jpg',
        vehicleId,
      }).success
    ).toBe(true);
    expect(
      RPC_CONTRACTS.replace_courier_document.inputSchema.safeParse({
        kind: 'license',
        storagePath: 'courier/x/license_1.jpg',
        vehicleId: 'no-es-uuid',
      }).success
    ).toBe(false);
  });
});

describe('CC-042 — FakeRpcClient de vehículos', () => {
  it('el vehículo actual queda como activo y el alta de otro no cambia el reflejo', async () => {
    const client = vehiclesClient();
    const initial = await vehicleIds(client);
    expect(initial.vehicles).toHaveLength(1);
    expect(initial.vehicles[0]).toMatchObject({ vehicleType: 'moto', plate: 'AB 123 CD', licenseStatus: 'verified' });
    expect(initial.activeVehicleId).toBe(initial.vehicles[0]?.id);

    const added = await client.add_courier_vehicle({ vehicleType: 'bike', plate: null, makeActive: false });
    expect(added.ok).toBe(true);
    expect(client.getCourier(COURIER_ID)?.vehicleType).toBe('moto');
    expect(await client.add_courier_vehicle({ vehicleType: 'bike', plate: null, makeActive: false })).toEqual({
      ok: false,
      code: 'DUPLICATE_VEHICLE',
    });
    expect(await client.add_courier_vehicle({ vehicleType: 'car', plate: 'mi auto', makeActive: false })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('el reflejo sigue al activo y la patente de la moto se conserva al alternar', async () => {
    const client = vehiclesClient();
    const added = await client.add_courier_vehicle({ vehicleType: 'bike', plate: null, makeActive: false });
    if (!added.ok) throw new Error(added.code);
    const motoId = (await vehicleIds(client)).activeVehicleId ?? '';

    expect(await client.set_active_courier_vehicle({ vehicleId: added.data.vehicleId })).toEqual({
      ok: true,
      data: { activeVehicleId: added.data.vehicleId },
    });
    expect(client.getCourier(COURIER_ID)).toMatchObject({
      vehicleType: 'bike',
      vehiclePlate: null,
      licenseStatus: 'none',
      insuranceStatus: 'none',
    });

    await client.set_active_courier_vehicle({ vehicleId: motoId });
    expect(client.getCourier(COURIER_ID)).toMatchObject({
      vehicleType: 'moto',
      vehiclePlate: 'AB 123 CD',
      licenseStatus: 'verified',
      insuranceStatus: 'verified',
    });
  });

  it('cambiar la patente del activo devuelve el seguro a none y conserva la licencia', async () => {
    const client = vehiclesClient();
    const motoId = (await vehicleIds(client)).activeVehicleId ?? '';
    expect((await client.update_courier_vehicle({ vehicleId: motoId, plate: 'ac 456 bd' })).ok).toBe(true);
    expect(client.getCourier(COURIER_ID)).toMatchObject({
      vehiclePlate: 'AC 456 BD',
      licenseStatus: 'verified',
      insuranceStatus: 'none',
    });
  });

  it('no se quita el activo ni se activa un vehículo ajeno o archivado', async () => {
    const client = vehiclesClient();
    const motoId = (await vehicleIds(client)).activeVehicleId ?? '';
    expect(await client.remove_courier_vehicle({ vehicleId: motoId })).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    const added = await client.add_courier_vehicle({ vehicleType: 'walk', plate: null, makeActive: false });
    if (!added.ok) throw new Error(added.code);
    expect((await client.remove_courier_vehicle({ vehicleId: added.data.vehicleId })).ok).toBe(true);
    expect(await client.set_active_courier_vehicle({ vehicleId: added.data.vehicleId })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
    expect(await client.set_active_courier_vehicle({ vehicleId: '30000000-0000-4000-8000-0000000000ff' })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('VEHICLE_SWITCH_BLOCKED con una oferta pendiente vigente y con un viaje activo', async () => {
    const client = vehiclesClient();
    const added = await client.add_courier_vehicle({ vehicleType: 'bike', plate: null, makeActive: false });
    if (!added.ok) throw new Error(added.code);

    client.seedRequest({
      requestId: '40000000-0000-4000-8000-000000000001',
      merchantId: MERCHANT_ID,
      status: 'published',
      expiresAt: '2026-11-06T13:00:00.000Z',
    });
    client.seedOffer({
      offerId: '50000000-0000-4000-8000-000000000001',
      requestId: '40000000-0000-4000-8000-000000000001',
      courierId: COURIER_ID,
      amountArs: 1500,
      status: 'pending',
    });
    expect(await client.set_active_courier_vehicle({ vehicleId: added.data.vehicleId })).toEqual({
      ok: false,
      code: 'VEHICLE_SWITCH_BLOCKED',
    });
    expect(client.getCourier(COURIER_ID)?.vehicleType).toBe('moto');

    client.seedOffer({
      offerId: '50000000-0000-4000-8000-000000000001',
      requestId: '40000000-0000-4000-8000-000000000001',
      courierId: COURIER_ID,
      amountArs: 1500,
      status: 'withdrawn',
    });
    client.seedRequest({
      requestId: '40000000-0000-4000-8000-000000000002',
      merchantId: MERCHANT_ID,
      status: 'in_transit',
      acceptedOfferId: '50000000-0000-4000-8000-000000000002',
      assignedCourierId: COURIER_ID,
    });
    client.seedOffer({
      offerId: '50000000-0000-4000-8000-000000000002',
      requestId: '40000000-0000-4000-8000-000000000002',
      courierId: COURIER_ID,
      amountArs: 1500,
      status: 'accepted',
    });
    expect(await client.set_active_courier_vehicle({ vehicleId: added.data.vehicleId })).toEqual({
      ok: false,
      code: 'VEHICLE_SWITCH_BLOCKED',
    });
  });

  it('autorización: postulación sin enviar, suspendido o consentimiento inactivo', async () => {
    expect(
      await vehiclesClient({ applicationSubmitted: false }).add_courier_vehicle({
        vehicleType: 'bike',
        plate: null,
        makeActive: false,
      })
    ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });
    expect(
      await vehiclesClient({ status: 'suspended' }).add_courier_vehicle({ vehicleType: 'bike', plate: null, makeActive: false })
    ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    expect(await vehiclesClient({ consentStatus: 'reconsent_required' }).get_my_courier_vehicles({})).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
  });
});

describe('CC-042 — FakeRpcClient de vehículos: bordes', () => {
  it('patente: misma patente sin cambios, inválida, nula en moto y con patente en bici', async () => {
    const client = vehiclesClient();
    const motoId = (await vehicleIds(client)).activeVehicleId ?? '';
    expect(await client.update_courier_vehicle({ vehicleId: motoId, plate: ' ab 123 cd ' })).toEqual({
      ok: true,
      data: { vehicleId: motoId },
    });
    expect(client.getCourier(COURIER_ID)?.insuranceStatus).toBe('verified');
    expect(await client.update_courier_vehicle({ vehicleId: motoId, plate: null })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(await client.add_courier_vehicle({ vehicleType: 'bike', plate: 'AB 123 CD', makeActive: false })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(await client.update_courier_vehicle({ vehicleId: '30000000-0000-4000-8000-0000000000ff', plate: 'AB 123 CD' })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
    expect(await client.remove_courier_vehicle({ vehicleId: '30000000-0000-4000-8000-0000000000ff' })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('un inactivo cambia de patente aunque haya ofertas; el activo y el alta con makeActive quedan bloqueados', async () => {
    const client = vehiclesClient();
    const motoId = (await vehicleIds(client)).activeVehicleId ?? '';
    const car = await client.add_courier_vehicle({ vehicleType: 'car', plate: 'AB 111 CD', makeActive: false });
    if (!car.ok) throw new Error(car.code);
    client.seedRequest({
      requestId: '40000000-0000-4000-8000-000000000003',
      merchantId: MERCHANT_ID,
      status: 'published',
      expiresAt: null,
    });
    client.seedOffer({
      offerId: '50000000-0000-4000-8000-000000000003',
      requestId: '40000000-0000-4000-8000-000000000003',
      courierId: COURIER_ID,
      amountArs: 1500,
      status: 'pending',
    });
    expect((await client.update_courier_vehicle({ vehicleId: car.data.vehicleId, plate: 'AB 222 CD' })).ok).toBe(true);
    expect(await client.update_courier_vehicle({ vehicleId: motoId, plate: 'AB 999 CD' })).toEqual({
      ok: false,
      code: 'VEHICLE_SWITCH_BLOCKED',
    });
    expect(await client.add_courier_vehicle({ vehicleType: 'walk', plate: null, makeActive: true })).toEqual({
      ok: false,
      code: 'VEHICLE_SWITCH_BLOCKED',
    });
  });

  it('una oferta pendiente vencida o de una solicitud desconocida no bloquea', async () => {
    const client = vehiclesClient();
    const bike = await client.add_courier_vehicle({ vehicleType: 'bike', plate: null, makeActive: false });
    if (!bike.ok) throw new Error(bike.code);
    client.seedRequest({
      requestId: '40000000-0000-4000-8000-000000000004',
      merchantId: MERCHANT_ID,
      status: 'published',
      expiresAt: '2026-11-06T11:00:00.000Z',
    });
    client.seedOffer({
      offerId: '50000000-0000-4000-8000-000000000004',
      requestId: '40000000-0000-4000-8000-000000000004',
      courierId: COURIER_ID,
      amountArs: 1500,
      status: 'pending',
    });
    client.seedOffer({
      offerId: '50000000-0000-4000-8000-000000000005',
      requestId: '40000000-0000-4000-8000-0000000000ff',
      courierId: COURIER_ID,
      amountArs: 1500,
      status: 'pending',
    });
    client.seedOffer({
      offerId: '50000000-0000-4000-8000-000000000006',
      requestId: '40000000-0000-4000-8000-000000000004',
      courierId: '20000000-0000-4000-8000-0000000042c9',
      amountArs: 1500,
      status: 'pending',
    });
    expect((await client.set_active_courier_vehicle({ vehicleId: bike.data.vehicleId })).ok).toBe(true);
  });

  it('un repartidor en bici sin vehículos previos y uno sin vehículo: el primero agregado queda activo', async () => {
    const bikeClient = createFakeRpcClient({
      settings: SETTINGS,
      now: () => NOW,
      initialActor: { userId: COURIER_ID, role: 'courier', consentStatus: 'active', aal: 'aal1' },
      initialCouriers: [
        {
          courierId: COURIER_ID,
          status: 'approved',
          available: true,
          vehicleType: 'bike',
          vehiclePlate: null,
          licenseStatus: 'verified',
          applicationSubmitted: true,
        },
      ],
    });
    const listed = await vehicleIds(bikeClient);
    expect(listed.vehicles[0]).toMatchObject({ vehicleType: 'bike', plate: null, licenseStatus: 'none' });

    const noVehicleClient = createFakeRpcClient({
      settings: SETTINGS,
      now: () => NOW,
      initialActor: { userId: COURIER_ID, role: 'courier', consentStatus: 'active', aal: 'aal1' },
      initialCouriers: [
        { courierId: COURIER_ID, status: 'pending', available: false, vehicleType: null, applicationSubmitted: true },
      ],
    });
    expect((await vehicleIds(noVehicleClient)).vehicles).toHaveLength(0);
    const first = await noVehicleClient.add_courier_vehicle({ vehicleType: 'walk', plate: null, makeActive: false });
    if (!first.ok) throw new Error(first.code);
    expect((await vehicleIds(noVehicleClient)).activeVehicleId).toBe(first.data.vehicleId);
    expect(noVehicleClient.getCourier(COURIER_ID)?.vehicleType).toBe('walk');
  });

  it('get_my_courier_vehicles rechaza a un rechazado y la lista no incluye vehículos de otro', async () => {
    expect(await vehiclesClient({ status: 'rejected' }).get_my_courier_vehicles({})).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    expect(await vehiclesClient({ status: 'rejected' }).set_active_courier_vehicle({
      vehicleId: '30000000-0000-4000-8000-0000000000ff',
    })).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
  });
});
