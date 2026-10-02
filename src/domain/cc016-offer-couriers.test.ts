import { describe, expect, it } from 'vitest';
import { RPC_CONTRACTS } from './index';
import { sortOffersForMerchant } from './priority';
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

const MERCHANT_A = '10000000-0000-4000-8000-0000000000a1';
const MERCHANT_B = '10000000-0000-4000-8000-0000000000b1';
const COURIER_DOC2 = '20000000-0000-4000-8000-0000000000c2';
const COURIER_DOC0 = '20000000-0000-4000-8000-0000000000c0';
const COURIER_OTHER = '20000000-0000-4000-8000-0000000000c9';
const ADMIN = '90000000-0000-4000-8000-000000000001';
const REQ_A = '30000000-0000-4000-8000-0000000000a1';
const REQ_B = '30000000-0000-4000-8000-0000000000b1';
const REQ_MISSING = '30000000-0000-4000-8000-999999999999';

function fake() {
  return createFakeRpcClient({
    settings: SETTINGS,
    initialActor: { userId: MERCHANT_A, role: 'merchant' },
    initialRequests: [
      { requestId: REQ_A, merchantId: MERCHANT_A, status: 'published' },
      { requestId: REQ_B, merchantId: MERCHANT_B, status: 'published' },
    ],
    initialCouriers: [
      {
        courierId: COURIER_DOC2,
        status: 'approved',
        available: true,
        licenseStatus: 'verified',
        insuranceStatus: 'verified',
        displayName: 'Cadete Doc2',
        phone: '3865000002',
        vehicleType: 'moto',
        vehiclePlate: 'AA123BB',
      },
      {
        courierId: COURIER_DOC0,
        status: 'approved',
        available: true,
        displayName: 'Cadete Doc0',
        phone: '3865000000',
        vehicleType: 'bike',
      },
      {
        courierId: COURIER_OTHER,
        status: 'approved',
        available: true,
        displayName: 'Cadete Ajeno',
      },
    ],
    initialOffers: [
      {
        offerId: '50000000-0000-4000-8000-0000000000c2',
        requestId: REQ_A,
        courierId: COURIER_DOC2,
        amountArs: 2000,
        status: 'pending',
      },
      {
        offerId: '50000000-0000-4000-8000-0000000000c0',
        requestId: REQ_A,
        courierId: COURIER_DOC0,
        amountArs: 1500,
        status: 'pending',
      },
      {
        offerId: '50000000-0000-4000-8000-0000000000c9',
        requestId: REQ_B,
        courierId: COURIER_OTHER,
        amountArs: 1700,
        status: 'pending',
      },
    ],
  });
}

describe('CC-016 — get_request_offer_couriers', () => {
  it('el contrato solo admite los seis campos de la proyección', () => {
    const schema = RPC_CONTRACTS.get_request_offer_couriers.outputSchema;
    const courier = {
      courierId: COURIER_DOC2,
      displayName: 'Cadete Doc2',
      vehicleType: 'moto',
      licenseStatus: 'verified',
      insuranceStatus: 'verified',
      docLevel: 2,
    };

    expect(schema.safeParse({ requestId: REQ_A, couriers: [courier] }).success).toBe(true);
    for (const extra of [
      { phone: '3865000002' },
      { vehiclePlate: 'AA123BB' },
      { dniHmac: 'ab'.repeat(32) },
      { status: 'approved' },
    ]) {
      expect(
        schema.safeParse({ requestId: REQ_A, couriers: [{ ...courier, ...extra }] }).success
      ).toBe(false);
    }
    expect(
      schema.safeParse({ requestId: REQ_A, couriers: [{ ...courier, docLevel: 3 }] }).success
    ).toBe(false);
  });

  it('el comercio dueño recibe solo a quienes ofertaron en su solicitud, con el nivel real', async () => {
    const result = await fake().get_request_offer_couriers({ requestId: REQ_A });

    expect(result).toEqual({
      ok: true,
      data: {
        requestId: REQ_A,
        couriers: [
          {
            courierId: COURIER_DOC0,
            displayName: 'Cadete Doc0',
            vehicleType: 'bike',
            licenseStatus: 'none',
            insuranceStatus: 'none',
            docLevel: 0,
          },
          {
            courierId: COURIER_DOC2,
            displayName: 'Cadete Doc2',
            vehicleType: 'moto',
            licenseStatus: 'verified',
            insuranceStatus: 'verified',
            docLevel: 2,
          },
        ],
      },
    });
  });

  it('la proyección alcanza para los dos órdenes de la lista: documentación 2 antes de 0 y $1500 antes de $2000', async () => {
    const result = await fake().get_request_offer_couriers({ requestId: REQ_A });
    if (!result.ok) throw new Error(result.code);

    const docLevelByCourier = new Map(result.data.couriers.map((c) => [c.courierId, c.docLevel]));
    const offers = [
      { id: 'o-doc2', courierId: COURIER_DOC2, amountArs: 2000 },
      { id: 'o-doc0', courierId: COURIER_DOC0, amountArs: 1500 },
    ].map((offer) => {
      const docLevel = docLevelByCourier.get(offer.courierId);
      if (docLevel === undefined) throw new Error('courier sin proyección');
      return { ...offer, docLevel, createdAt: '2026-10-02T12:00:00.000Z' };
    });

    expect(sortOffersForMerchant(offers, 'doc_level').map((o) => o.id)).toEqual([
      'o-doc2',
      'o-doc0',
    ]);
    expect(sortOffersForMerchant(offers, 'price').map((o) => o.id)).toEqual(['o-doc0', 'o-doc2']);
  });

  it('otro comercio no lee la solicitud ajena y la inexistente responde igual', async () => {
    const client = fake();
    client.setActor({ userId: MERCHANT_B, role: 'merchant' });

    expect(await client.get_request_offer_couriers({ requestId: REQ_A })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
    expect(await client.get_request_offer_couriers({ requestId: REQ_MISSING })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });

    const own = await client.get_request_offer_couriers({ requestId: REQ_B });
    expect(own.ok && own.data.couriers.map((c) => c.courierId)).toEqual([COURIER_OTHER]);
  });

  it('rechaza repartidor, admin, sesión ausente y comercio sin consentimiento activo', async () => {
    const client = fake();

    client.setActor({ userId: COURIER_DOC2, role: 'courier' });
    expect(await client.get_request_offer_couriers({ requestId: REQ_A })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    client.setActor({ userId: ADMIN, role: 'admin', aal: 'aal2' });
    expect(await client.get_request_offer_couriers({ requestId: REQ_A })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    client.setActor({ userId: '', role: null });
    expect(await client.get_request_offer_couriers({ requestId: REQ_A })).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
    });

    client.setActor({ userId: MERCHANT_A, role: 'merchant', consentStatus: 'pending' });
    expect(await client.get_request_offer_couriers({ requestId: REQ_A })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
  });
});
