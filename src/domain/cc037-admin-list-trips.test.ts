import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import { type FakePlatformSettings, type FakeSeedRequest, createFakeRpcClient } from './testing/rpc-fake';

const item = {
  id: '00000000-0000-4000-8000-000000370001',
  code: 'REQ-00000000',
  status: 'delivered',
  createdAt: '2026-10-22T03:00:00.000000Z',
  publishedAt: '2026-10-22T03:00:00.000000Z',
  deliveredAt: '2026-10-22T04:00:00.000000Z',
  cancelledAt: null,
  merchantId: '00000000-0000-4000-8000-0000000370b1',
  merchantName: 'Comercio',
  courierId: '00000000-0000-4000-8000-0000000370c1',
  courierName: 'Repartidor',
  dropsCount: 2,
  deliveredDrops: 1,
  failedDrops: 1,
  courierReleases: 0,
  noShowReports: 0,
  cancelled: false,
  incidents: 0,
  openIncidents: 0,
};

describe('CC-037: contrato de admin_list_trips', () => {
  const contract = RPC_CONTRACTS.admin_list_trips;

  it('está registrado con los errores canónicos de las RPC admin', () => {
    expect(ALL_RPC_NAMES).toContain('admin_list_trips');
    expect(contract.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
    ]);
  });

  it('acepta los filtros problems y all, con cursor completo y límite 1–50', () => {
    expect(contract.inputSchema.safeParse({ filter: 'problems' }).success).toBe(true);
    expect(
      contract.inputSchema.safeParse({
        filter: 'all',
        cursor: { createdAt: '2026-10-22T03:00:00.123456Z', id: item.id },
        limit: 50,
      }).success
    ).toBe(true);
  });

  it('rechaza un filtro desconocido, un cursor incompleto y límites fuera de rango', () => {
    expect(contract.inputSchema.safeParse({ filter: 'open' }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ filter: 'all', cursor: { id: item.id } }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ filter: 'all', limit: 0 }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ filter: 'all', limit: 51 }).success).toBe(false);
  });

  it('parsea la salida de la RPC con su nextCursor', () => {
    const parsed = contract.outputSchema.safeParse({
      items: [item],
      nextCursor: { createdAt: item.createdAt, id: item.id },
    });
    expect(parsed.success).toBe(true);
    expect(contract.outputSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });

  it('es estricto: una clave extra (por ejemplo un dato del destinatario) invalida la salida', () => {
    for (const extra of ['recipientName', 'recipientPhone', 'dropoffAddress', 'cashChangeAmount', 'failedReason']) {
      expect(
        contract.outputSchema.safeParse({ items: [{ ...item, [extra]: 'x' }], nextCursor: null }).success,
        extra
      ).toBe(false);
    }
  });

  it('exige el formato de código REQ- y un estado de solicitud válido', () => {
    expect(contract.outputSchema.safeParse({ items: [{ ...item, code: 'REQ-abc' }], nextCursor: null }).success).toBe(
      false
    );
    expect(
      contract.outputSchema.safeParse({ items: [{ ...item, status: 'lost' }], nextCursor: null }).success
    ).toBe(false);
  });
});

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

const ADMIN = '90000000-0000-4000-8000-000000000001';
const MERCHANT = '10000000-0000-4000-8000-000000000001';
const COURIER = '20000000-0000-4000-8000-00000000000a';
const req = (n: number) => `30000000-0000-4000-8000-00000000000${n}`;
const OFFER = '50000000-0000-4000-8000-00000000000a';

// r1 entregada completa, r2 parcial, r3 repartidor soltó, r4 cancelada, r5 no-show, r6 legacy con incidente abierto,
// r7 vencida, r8 borrador. r3 y r4 empatan en createdAt.
const REQUESTS: FakeSeedRequest[] = [
  {
    requestId: req(1),
    merchantId: MERCHANT,
    status: 'delivered',
    createdAt: '2026-10-22T02:00:00.000000Z',
    acceptedOfferId: OFFER,
    drops: [
      { status: 'delivered', deliveredAt: '2026-10-22T02:30:00.000000Z' },
      { status: 'delivered', deliveredAt: '2026-10-22T02:40:00.000000Z' },
    ],
  },
  {
    requestId: req(2),
    merchantId: MERCHANT,
    status: 'delivered',
    createdAt: '2026-10-22T01:00:00.000000Z',
    drops: [
      { status: 'delivered', deliveredAt: '2026-10-22T01:30:00.000000Z' },
      { status: 'failed', failedReason: 'No responde' },
    ],
  },
  { requestId: req(3), merchantId: MERCHANT, status: 'published', createdAt: '2026-10-22T00:00:00.000000Z' },
  { requestId: req(4), merchantId: MERCHANT, status: 'cancelled', createdAt: '2026-10-22T00:00:00.000000Z' },
  { requestId: req(5), merchantId: MERCHANT, status: 'published', createdAt: '2026-10-21T23:00:00.000000Z' },
  { requestId: req(6), merchantId: MERCHANT, status: 'delivered', createdAt: '2026-10-21T22:00:00.000000Z' },
  { requestId: req(7), merchantId: MERCHANT, status: 'expired', createdAt: '2026-10-21T21:00:00.000000Z' },
  { requestId: req(8), merchantId: MERCHANT, status: 'draft', createdAt: '2026-10-22T03:00:00.000000Z' },
];

function tripsFake() {
  return createFakeRpcClient({
    settings: SETTINGS,
    now: () => new Date('2026-10-22T05:00:00.000Z'),
    initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2' },
    initialMerchants: [{ merchantId: MERCHANT, subscriptionStatus: 'pilot', businessName: 'Comercio CC037' }],
    initialCouriers: [{ courierId: COURIER, status: 'approved', available: true, displayName: 'Repartidor CC037' }],
    initialRequests: REQUESTS,
    initialOffers: [{ offerId: OFFER, requestId: req(1), courierId: COURIER, amountArs: 1500, status: 'accepted' }],
    initialCancellationReasons: [
      {
        id: '60000000-0000-4000-8000-000000000001',
        requestId: req(3),
        offerId: null,
        actorId: COURIER,
        action: 'courier_cancel_match',
        reason: 'Emergencia',
        createdAt: '2026-10-22T00:10:00.000000Z',
      },
      {
        id: '60000000-0000-4000-8000-000000000002',
        requestId: req(5),
        offerId: null,
        actorId: MERCHANT,
        action: 'report_no_show',
        reason: 'no_show',
        createdAt: '2026-10-21T23:10:00.000000Z',
      },
    ],
    initialIncidents: [
      {
        incidentId: '70000000-0000-4000-8000-000000000001',
        requestId: req(6),
        reporterId: MERCHANT,
        reporterRole: 'merchant',
        kind: 'other',
        description: 'Llegó roto',
        createdAt: '2026-10-21T22:30:00.000000Z',
      },
      {
        incidentId: '70000000-0000-4000-8000-000000000002',
        requestId: req(6),
        reporterId: MERCHANT,
        reporterRole: 'merchant',
        kind: 'other',
        description: 'Otro reclamo',
        status: 'resolved',
        createdAt: '2026-10-21T22:40:00.000000Z',
      },
    ],
  });
}

type ListResult = Awaited<ReturnType<ReturnType<typeof tripsFake>['admin_list_trips']>>;
const ids = (result: ListResult) => (result.ok ? result.data.items.map((i) => i.id) : null);
const [tieHigh, tieLow] = [req(3), req(4)].sort().reverse();

describe('CC-037: admin_list_trips en el fake del dominio', () => {
  it('problems: los 5 tipos de problema en orden created_at desc, id desc; all suma la completa y la vencida', async () => {
    const fake = tripsFake();
    expect(ids(await fake.admin_list_trips({ filter: 'problems' }))).toEqual([req(2), tieHigh, tieLow, req(5), req(6)]);
    expect(ids(await fake.admin_list_trips({ filter: 'all' }))).toEqual([
      req(1),
      req(2),
      tieHigh,
      tieLow,
      req(5),
      req(6),
      req(7),
    ]);
  });

  it('conteos, nombres y legacy sin entregas', async () => {
    const result = await tripsFake().admin_list_trips({ filter: 'all' });
    if (!result.ok) throw new Error(result.code);
    const byId = new Map(result.data.items.map((i) => [i.id, i]));

    expect(byId.get(req(1))).toMatchObject({
      code: 'REQ-30000000',
      merchantName: 'Comercio CC037',
      courierId: COURIER,
      courierName: 'Repartidor CC037',
      dropsCount: 2,
      deliveredDrops: 2,
      failedDrops: 0,
      cancelled: false,
    });
    expect(byId.get(req(2))).toMatchObject({ dropsCount: 2, deliveredDrops: 1, failedDrops: 1, courierName: null });
    expect(byId.get(req(3))).toMatchObject({ courierReleases: 1, dropsCount: 1, deliveredDrops: 0 });
    expect(byId.get(req(4))).toMatchObject({ cancelled: true });
    expect(byId.get(req(5))).toMatchObject({ noShowReports: 1 });
    expect(byId.get(req(6))).toMatchObject({ incidents: 2, openIncidents: 1, dropsCount: 1, deliveredDrops: 1 });
  });

  it('keyset: páginas de 2 cruzando el empate, sin repetir ni saltear, y la última sin cursor', async () => {
    const fake = tripsFake();
    const first = await fake.admin_list_trips({ filter: 'problems', limit: 2 });
    if (!first.ok || !first.data.nextCursor) throw new Error('sin primera página');
    expect(ids(first)).toEqual([req(2), tieHigh]);

    const second = await fake.admin_list_trips({ filter: 'problems', limit: 2, cursor: first.data.nextCursor });
    if (!second.ok || !second.data.nextCursor) throw new Error('sin segunda página');
    expect(ids(second)).toEqual([tieLow, req(5)]);

    const last = await fake.admin_list_trips({ filter: 'problems', limit: 2, cursor: second.data.nextCursor });
    expect(ids(last)).toEqual([req(6)]);
    expect(last.ok ? last.data.nextCursor : 'error').toBeNull();
  });

  it('autorización y validación como la RPC', async () => {
    const fake = tripsFake();
    fake.setActor({ userId: ADMIN, role: 'admin', aal: 'aal1' });
    expect(await fake.admin_list_trips({ filter: 'all' })).toMatchObject({ ok: false, code: 'AAL2_REQUIRED' });
    fake.setActor({ userId: MERCHANT, role: 'merchant', aal: 'aal2' });
    expect(await fake.admin_list_trips({ filter: 'all' })).toMatchObject({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    fake.setActor({ userId: ADMIN, role: 'admin', aal: 'aal2' });
    expect(await fake.admin_list_trips({ filter: 'open' } as never)).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });
});
