import { describe, expect, it } from 'vitest';
import { createFakeRpcClient } from './testing/rpc-fake';

const merchant = '10000000-0000-4000-8000-000000000001';
const request = '30000000-0000-4000-8000-000000000001';
const secondRequest = '30000000-0000-4000-8000-000000000002';
const settings = {
  minOfferArs: 1500,
  maxOffersPerMin: 10,
  requestTtlMinutes: 30,
  pilotActive: true,
  pilotTermsVersion: 'v1',
  subscriptionGraceDays: 0,
  maxRequestPublicationsPerMin: 2,
  maxIncidentsPerMin: 2,
};

describe('CC-004 — Límites configurables de solicitudes', () => {
  it.each(['maxRequestPublicationsPerMin', 'maxIncidentsPerMin'] as const)(
    '%s exige un entero positivo explícito',
    (key) => {
      for (const value of [undefined, 0, -1, 1.5, Number.NaN]) {
        expect(() => createFakeRpcClient({ settings: { ...settings, [key]: value } })).toThrow();
      }
    }
  );

  it('publish y republish comparten cupo por comercio; errores no consumen y la ventana se renueva', async () => {
    let now = new Date('2026-09-23T18:00:30Z');
    const fake = createFakeRpcClient({
      settings,
      now: () => now,
      initialActor: { userId: merchant, role: 'merchant' },
      initialRequests: [
        { requestId: request, merchantId: merchant, status: 'draft' },
        { requestId: secondRequest, merchantId: merchant, status: 'draft' },
      ],
    });
    expect(await fake.publish_request({ requestId: request })).toMatchObject({ ok: true });
    expect(await fake.publish_request({ requestId: request })).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(await fake.cancel_request({ requestId: request })).toMatchObject({ ok: true });
    expect(await fake.republish_request({ requestId: request })).toMatchObject({ ok: true });
    expect(await fake.publish_request({ requestId: secondRequest })).toEqual({
      ok: false,
      code: 'RATE_LIMITED',
    });
    expect(fake.getRequest(secondRequest)?.status).toBe('draft');
    now = new Date('2026-09-23T18:01:00Z');
    expect(await fake.publish_request({ requestId: secondRequest })).toMatchObject({ ok: true });
  });

  it('republish limitado no cancela la oferta aceptada ni altera la solicitud', async () => {
    const offerId = '40000000-0000-4000-8000-000000000001';
    const courier = '20000000-0000-4000-8000-000000000001';
    const fake = createFakeRpcClient({
      settings: { ...settings, maxRequestPublicationsPerMin: 1 },
      now: () => new Date('2026-09-23T18:00:30Z'),
      initialActor: { userId: merchant, role: 'merchant' },
      initialRequests: [
        { requestId: request, merchantId: merchant, status: 'draft' },
        {
          requestId: secondRequest,
          merchantId: merchant,
          status: 'matched',
          acceptedOfferId: offerId,
          assignedCourierId: courier,
        },
      ],
      initialOffers: [
        {
          offerId,
          requestId: secondRequest,
          courierId: courier,
          amountArs: 1500,
          status: 'accepted',
        },
      ],
    });
    expect(await fake.publish_request({ requestId: request })).toMatchObject({ ok: true });
    expect(await fake.republish_request({ requestId: secondRequest, reason: 'No llegó' })).toEqual({
      ok: false,
      code: 'RATE_LIMITED',
    });
    expect(fake.getRequest(secondRequest)?.status).toBe('matched');
    expect(fake.getOffer(offerId)?.status).toBe('accepted');
  });

  // CC-012 / D05-A: los incidentes se reportan desde matched (no published) y el admin nunca reporta;
  // el segundo actor que demuestra el cupo aislado es el repartidor asignado.
  it('incidentes tienen cupo independiente de publicar y aislado por actor', async () => {
    let now = new Date('2026-09-23T18:00:30Z');
    const courier = '20000000-0000-4000-8000-000000000001';
    const acceptedOffer = '50000000-0000-4000-8000-000000000001';
    const fake = createFakeRpcClient({
      settings,
      now: () => now,
      initialActor: { userId: merchant, role: 'merchant' },
      initialRequests: [
        { requestId: request, merchantId: merchant, status: 'draft' },
        {
          requestId: secondRequest,
          merchantId: merchant,
          status: 'matched',
          // CC-012 / PR115-H03: el repartidor participa por la oferta accepted real, como en Postgres.
          acceptedOfferId: acceptedOffer,
          assignedCourierId: courier,
        },
      ],
      initialOffers: [
        { offerId: acceptedOffer, requestId: secondRequest, courierId: courier, amountArs: 1500, status: 'accepted' },
      ],
      initialCouriers: [{ courierId: courier, status: 'approved', available: true }],
    });
    const onDraft = { requestId: request, kind: 'other' as const, description: 'Demora de prueba' };
    const input = { requestId: secondRequest, kind: 'other' as const, description: 'Demora de prueba' };
    expect(await fake.report_incident(onDraft)).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(await fake.publish_request({ requestId: request })).toMatchObject({ ok: true });
    expect(await fake.report_incident(input)).toMatchObject({ ok: true });
    expect(await fake.report_incident(input)).toMatchObject({ ok: true });
    expect(await fake.report_incident(input)).toEqual({ ok: false, code: 'RATE_LIMITED' });
    fake.setActor({ userId: courier, role: 'courier' });
    expect(await fake.report_incident(input)).toMatchObject({ ok: true });
    fake.setActor({ userId: merchant, role: 'merchant' });
    now = new Date('2026-09-23T18:01:00Z');
    expect(await fake.report_incident(input)).toMatchObject({ ok: true });
  });
});
