import { describe, expect, it } from 'vitest';
import {
  INCIDENT_KINDS,
  RPC_CONTRACTS,
  incidentDescriptionHasContact,
  incidentKindSchema,
} from './index';
import { type FakePlatformSettings, type FakeSeedIncident, createFakeRpcClient } from './testing/rpc-fake';

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

const MERCHANT = '10000000-0000-4000-8000-000000000001';
const COURIER_A = '20000000-0000-4000-8000-00000000000a';
const COURIER_B = '20000000-0000-4000-8000-00000000000b';
const ADMIN = '90000000-0000-4000-8000-000000000001';
const REQ_MATCHED = '30000000-0000-4000-8000-000000000001';
const REQ_PUBLISHED_1 = '30000000-0000-4000-8000-000000000002';
const REQ_PUBLISHED_2 = '30000000-0000-4000-8000-000000000003';
const REQ_NO_COURIER = '30000000-0000-4000-8000-000000000004';
const OFFER_ACCEPTED_A = '50000000-0000-4000-8000-00000000000a';
const OFFER_REJECTED_B = '50000000-0000-4000-8000-00000000000b';
const OFFER_PENDING_A1 = '50000000-0000-4000-8000-0000000000a1';
const OFFER_PENDING_A2 = '50000000-0000-4000-8000-0000000000a2';
const OFFER_PENDING_B = '50000000-0000-4000-8000-0000000000b1';
const NOW = new Date('2026-09-27T15:00:00.000Z');

function incident(id: string, overrides: Partial<FakeSeedIncident> = {}): FakeSeedIncident {
  return {
    incidentId: `e0000000-0000-4000-8000-000000000${id}`,
    requestId: REQ_MATCHED,
    reporterId: MERCHANT,
    reporterRole: 'merchant',
    reporterName: 'Panadería La Espiga',
    kind: 'other',
    description: 'Demora en el retiro',
    createdAt: '2026-09-27T12:00:00.000Z',
    ...overrides,
  };
}

function adminFake(extraIncidents: readonly FakeSeedIncident[] = []) {
  return createFakeRpcClient({
    settings: SETTINGS,
    now: () => NOW,
    initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2' },
    initialCouriers: [
      { courierId: COURIER_A, status: 'approved', available: true },
      { courierId: COURIER_B, status: 'approved', available: true },
    ],
    initialRequests: [
      { requestId: REQ_MATCHED, merchantId: MERCHANT, status: 'matched', acceptedOfferId: OFFER_ACCEPTED_A, assignedCourierId: COURIER_A },
      { requestId: REQ_PUBLISHED_1, merchantId: MERCHANT, status: 'published' },
      { requestId: REQ_PUBLISHED_2, merchantId: MERCHANT, status: 'published' },
      { requestId: REQ_NO_COURIER, merchantId: MERCHANT, status: 'published' },
    ],
    initialOffers: [
      { offerId: OFFER_ACCEPTED_A, requestId: REQ_MATCHED, courierId: COURIER_A, amountArs: 1500, status: 'accepted' },
      { offerId: OFFER_REJECTED_B, requestId: REQ_MATCHED, courierId: COURIER_B, amountArs: 1400, status: 'rejected' },
      { offerId: OFFER_PENDING_A1, requestId: REQ_PUBLISHED_1, courierId: COURIER_A, amountArs: 1500, status: 'pending' },
      { offerId: OFFER_PENDING_A2, requestId: REQ_PUBLISHED_2, courierId: COURIER_A, amountArs: 1500, status: 'pending' },
      { offerId: OFFER_PENDING_B, requestId: REQ_PUBLISHED_1, courierId: COURIER_B, amountArs: 1600, status: 'pending' },
    ],
    initialIncidents: [
      incident('a01'),
      incident('a02', { status: 'resolved', resolution: 'warning: listo' }),
      incident('a03', { status: 'dismissed', resolution: 'no_action: listo' }),
      incident('a04', { requestId: REQ_NO_COURIER }),
      incident('a05', { status: 'reviewing' }),
      ...extraIncidents,
    ],
  });
}

describe('CC-012: tipos canónicos y relato sin datos de contacto', () => {
  it('INCIDENT_KINDS es la única lista canónica y report_incident la usa', () => {
    expect(INCIDENT_KINDS).toEqual(['no_show', 'payment_issue', 'damaged_goods', 'safety', 'other']);
    expect(incidentKindSchema.safeParse('demora').success).toBe(false);
    const input = { requestId: REQ_MATCHED, description: 'Demora en el retiro' };
    for (const kind of INCIDENT_KINDS) {
      expect(RPC_CONTRACTS.report_incident.inputSchema.safeParse({ ...input, kind }).success).toBe(true);
    }
    expect(RPC_CONTRACTS.report_incident.inputSchema.safeParse({ ...input, kind: 'delay' }).success).toBe(false);
  });

  it.each([
    'Llamame al 3865 44-1122 para ver qué pasó.',
    'El cliente atiende en +54 9 3865 441122 siempre.',
    'Mi número es (3865) 441-122',
    'Escribime a juan.perez@correo.com por el reclamo.',
  ])('detecta datos de contacto en «%s»', (description) => {
    expect(incidentDescriptionHasContact(description)).toBe(true);
    expect(
      RPC_CONTRACTS.report_incident.inputSchema.safeParse({ requestId: REQ_MATCHED, kind: 'other', description })
        .success
    ).toBe(false);
  });

  it.each([
    'Pagó con $ 2.000 y no tenía cambio para $ 500 del envío.',
    'Pedido 4102 retirado a las 12:30 del 27/09',
    'La caja llegó abierta y faltaba una docena de facturas.',
  ])('acepta relatos sin contacto: «%s»', (description) => {
    expect(incidentDescriptionHasContact(description)).toBe(false);
  });
});

describe('CC-012: report_incident en el fake sigue la matriz D05-A', () => {
  function reporter(role: 'merchant' | 'courier', status: 'matched' | 'in_transit' | 'delivered', deliveredAt?: string) {
    return createFakeRpcClient({
      settings: SETTINGS,
      now: () => NOW,
      initialActor: role === 'merchant' ? { userId: MERCHANT, role } : { userId: COURIER_A, role },
      initialRequests: [
        { requestId: REQ_MATCHED, merchantId: MERCHANT, status, assignedCourierId: COURIER_A, deliveredAt: deliveredAt ?? null },
      ],
      initialCouriers: [{ courierId: COURIER_A, status: 'approved', available: true }],
    });
  }
  const report = { requestId: REQ_MATCHED, kind: 'other' as const, description: 'Demora en el retiro' };

  it.each(['matched', 'in_transit'] as const)('merchant dueño y courier asignado reportan en %s', async (status) => {
    expect((await reporter('merchant', status).report_incident(report)).ok).toBe(true);
    expect((await reporter('courier', status).report_incident(report)).ok).toBe(true);
  });

  it('en delivered dentro de 24 h reporta el merchant y no el courier', async () => {
    const deliveredAt = new Date(NOW.getTime() - 3_600_000).toISOString();
    expect((await reporter('merchant', 'delivered', deliveredAt).report_incident(report)).ok).toBe(true);
    expect(await reporter('courier', 'delivered', deliveredAt).report_incident(report)).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
  });

  it('el reporte llega a la bandeja: admin_list_incidents lo devuelve con su reportero', async () => {
    const fake = reporter('merchant', 'matched');
    const created = await fake.report_incident(report);
    if (!created.ok) throw new Error('el reporte debía crearse');
    expect(fake.getIncident(created.data.incidentId)).toMatchObject({ status: 'open', reporterRole: 'merchant' });

    fake.setActor({ userId: ADMIN, role: 'admin', aal: 'aal2' });
    const inbox = await fake.admin_list_incidents({ statuses: ['open', 'reviewing'] });
    expect(inbox.ok && inbox.data.items.map((item) => item.id)).toEqual([created.data.incidentId]);
  });

  it('el courier que reporta queda identificado como tal en la bandeja', async () => {
    const fake = reporter('courier', 'in_transit');
    const created = await fake.report_incident(report);
    if (!created.ok) throw new Error('el reporte debía crearse');
    expect(fake.getIncident(created.data.incidentId)?.reporterRole).toBe('courier');
  });
});

describe('CC-012: admin_resolve_incident en el fake', () => {
  const resolve = (suffix: string, decision: 'no_action' | 'warning' | 'preventive_suspension') => ({
    incidentId: `e0000000-0000-4000-8000-000000000${suffix}`,
    decision,
    reason: 'Motivo registrado',
  });

  it('merchant y courier no resuelven; el admin necesita aal2', async () => {
    const fake = adminFake();
    fake.setActor({ userId: MERCHANT, role: 'merchant' });
    expect(await fake.admin_resolve_incident(resolve('a01', 'warning'))).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    fake.setActor({ userId: COURIER_A, role: 'courier' });
    expect(await fake.admin_resolve_incident(resolve('a01', 'warning'))).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    fake.setActor({ userId: ADMIN, role: 'admin', aal: 'aal1' });
    expect(await fake.admin_resolve_incident(resolve('a01', 'warning'))).toEqual({ ok: false, code: 'AAL2_REQUIRED' });
    expect(fake.getIncident(resolve('a01', 'warning').incidentId)?.status).toBe('open');
  });

  it('valida parámetros y existencia', async () => {
    const fake = adminFake();
    expect(await fake.admin_resolve_incident({ ...resolve('a01', 'warning'), reason: '   ' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(
      await fake.admin_resolve_incident({ ...resolve('a01', 'warning'), incidentId: 'e0000000-0000-4000-8000-999999999999' })
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it.each(['a02', 'a03'])('un incidente cerrado (%s) no se vuelve a resolver', async (suffix) => {
    expect(await adminFake().admin_resolve_incident(resolve(suffix, 'no_action'))).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
  });

  it('no_action -> dismissed y warning -> resolved, sin repartidor', async () => {
    const fake = adminFake();
    expect(await fake.admin_resolve_incident(resolve('a01', 'no_action'))).toEqual({
      ok: true,
      data: { incidentId: resolve('a01', 'no_action').incidentId, status: 'dismissed', decision: 'no_action', courierId: null, withdrawnOffersCount: 0 },
    });
    expect(fake.getIncident(resolve('a01', 'no_action').incidentId)?.resolution).toBe('no_action: Motivo registrado');
    expect(await fake.admin_resolve_incident(resolve('a05', 'warning'))).toMatchObject({
      ok: true,
      data: { status: 'resolved', decision: 'warning', courierId: null },
    });
    expect(fake.getCourier(COURIER_A)?.status).toBe('approved');
  });

  it('preventive_suspension deriva el repartidor de la oferta accepted y aplica los efectos completos', async () => {
    const fake = adminFake();
    expect(await fake.admin_resolve_incident(resolve('a01', 'preventive_suspension'))).toEqual({
      ok: true,
      data: {
        incidentId: resolve('a01', 'preventive_suspension').incidentId,
        status: 'resolved',
        decision: 'preventive_suspension',
        courierId: COURIER_A,
        withdrawnOffersCount: 2,
      },
    });
    expect(fake.getCourier(COURIER_A)).toMatchObject({ status: 'suspended', available: false });
    expect(fake.getOffer(OFFER_PENDING_A1)?.status).toBe('withdrawn');
    expect(fake.getOffer(OFFER_PENDING_A2)?.status).toBe('withdrawn');
    expect(fake.getOffer(OFFER_ACCEPTED_A)?.status).toBe('accepted');
    expect(fake.getCourier(COURIER_B)).toMatchObject({ status: 'approved', available: true });
    expect(fake.getOffer(OFFER_PENDING_B)?.status).toBe('pending');
    expect(fake.getOffer(OFFER_REJECTED_B)?.status).toBe('rejected');
  });

  it('preventive_suspension sin oferta accepted o con el repartidor ya suspendido no toca nada', async () => {
    const fake = adminFake([incident('a06')]);
    expect(await fake.admin_resolve_incident(resolve('a04', 'preventive_suspension'))).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(fake.getIncident(resolve('a04', 'preventive_suspension').incidentId)?.status).toBe('open');

    expect((await fake.admin_resolve_incident(resolve('a01', 'preventive_suspension'))).ok).toBe(true);
    expect(await fake.admin_resolve_incident(resolve('a06', 'preventive_suspension'))).toEqual({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(fake.getIncident(resolve('a06', 'preventive_suspension').incidentId)?.status).toBe('open');
  });

  it('preventive_suspension con el repartidor inexistente devuelve NOT_FOUND', async () => {
    const fake = createFakeRpcClient({
      settings: SETTINGS,
      initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2' },
      initialRequests: [{ requestId: REQ_MATCHED, merchantId: MERCHANT, status: 'matched' }],
      initialOffers: [
        { offerId: OFFER_ACCEPTED_A, requestId: REQ_MATCHED, courierId: COURIER_A, amountArs: 1500, status: 'accepted' },
      ],
      initialIncidents: [incident('a01')],
    });
    expect(await fake.admin_resolve_incident(resolve('a01', 'preventive_suspension'))).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
  });
});

describe('CC-012: admin_list_incidents en el fake usa keyset estable', () => {
  const TIE = '2026-09-27T12:00:00.123Z';
  const ties = [
    incident('b00', { status: 'reviewing', createdAt: '2026-09-27T11:00:00.000Z' }),
    incident('b01', { status: 'reviewing', createdAt: TIE }),
    incident('b02', { status: 'reviewing', createdAt: TIE }),
  ];
  const id = (suffix: string) => `e0000000-0000-4000-8000-000000000${suffix}`;

  it('ordena por createdAt DESC, id DESC y pagina sin perder ni duplicar con empates exactos', async () => {
    const fake = adminFake(ties);
    const all = await fake.admin_list_incidents({ statuses: ['reviewing'], limit: 50 });
    // b01 y b02 empatan en 12:00:00.123; a05 es de 12:00:00.000 y b00 de 11:00.
    expect(all.ok && all.data.items.map((item) => item.id)).toEqual([id('b02'), id('b01'), id('a05'), id('b00')]);

    const seen: string[] = [];
    let cursor: { createdAt: string; id: string } | null = null;
    for (let page = 0; page < 5; page += 1) {
      const result = await fake.admin_list_incidents({ statuses: ['reviewing'], cursor, limit: 1 });
      if (!result.ok) throw new Error('la bandeja debía responder');
      seen.push(...result.data.items.map((item) => item.id));
      cursor = result.data.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual([id('b02'), id('b01'), id('a05'), id('b00')]);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('filtra por estado y usa 20 por defecto', async () => {
    const fake = adminFake(ties);
    const open = await fake.admin_list_incidents({ statuses: ['open'] });
    // a01 y a04 empatan en createdAt: desempata el id descendente.
    expect(open.ok && open.data.items.map((item) => item.id)).toEqual([id('a04'), id('a01')]);
    expect(open.ok && open.data.nextCursor).toBeNull();
  });

  it('solo el admin con aal2 lista y valida los parámetros', async () => {
    const fake = adminFake();
    expect(await fake.admin_list_incidents({ statuses: [] as unknown as ['open'] })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(await fake.admin_list_incidents({ statuses: ['open'], limit: 51 })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    fake.setActor({ userId: MERCHANT, role: 'merchant' });
    expect(await fake.admin_list_incidents({ statuses: ['open'] })).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
  });
});
