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

  it('incidentes tienen cupo independiente de publicar y aislado por actor', async () => {
    let now = new Date('2026-09-23T18:00:30Z');
    const fake = createFakeRpcClient({
      settings,
      now: () => now,
      initialActor: { userId: merchant, role: 'merchant' },
      initialRequests: [{ requestId: request, merchantId: merchant, status: 'draft' }],
    });
    const input = { requestId: request, kind: 'demora', description: 'Demora de prueba' };
    expect(await fake.report_incident(input)).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(await fake.publish_request({ requestId: request })).toMatchObject({ ok: true });
    expect(await fake.report_incident(input)).toMatchObject({ ok: true });
    expect(await fake.report_incident(input)).toMatchObject({ ok: true });
    expect(await fake.report_incident(input)).toEqual({ ok: false, code: 'RATE_LIMITED' });
    fake.setActor({ userId: '90000000-0000-4000-8000-000000000001', role: 'admin' });
    expect(await fake.report_incident(input)).toMatchObject({ ok: true });
    fake.setActor({ userId: merchant, role: 'merchant' });
    now = new Date('2026-09-23T18:01:00Z');
    expect(await fake.report_incident(input)).toMatchObject({ ok: true });
  });
});
