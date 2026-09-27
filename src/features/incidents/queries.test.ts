import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import type { IncidentsCursor } from '@/domain';
import {
  createFakeRpcClient,
  type FakePlatformSettings,
  type FakeSeedIncident,
} from '@/domain/testing/rpc-fake';
import { getIncidentDetail, getIncidentsQueue } from './queries';
import { incidentsInboxHref, parseIncidentsSearchParams } from './schemas';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

type ServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;

interface RecordedCall {
  readonly table: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

const CHAIN_METHODS = [
  'select',
  'eq',
  'neq',
  'lt',
  'gt',
  'in',
  'is',
  'or',
  'order',
  'limit',
  'range',
  'maybeSingle',
  'single',
] as const;

/** Cliente simulado: `rpc()` responde con `rpcResponse` y el query builder registra cada llamada. */
function mockClient(
  resultsByTable: Record<string, { data: unknown; error: unknown }>,
  rpcResponse: { data: unknown; error: unknown } = { data: { items: [], nextCursor: null }, error: null }
) {
  const calls: RecordedCall[] = [];
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    return builder;
  });
  const rpc = vi.fn().mockResolvedValue(rpcResponse);
  vi.mocked(serverSupabase.createClient).mockResolvedValue({ from, rpc } as unknown as ServerClient);
  return { from, rpc, calls };
}

function callsOf(calls: readonly RecordedCall[], table: string, method: string) {
  return calls.filter((call) => call.table === table && call.method === method);
}

const CONTACT_COLUMNS = /delivery_request_contacts|recipient|dropoff_address|pickup_address|_lat|_lng/i;

const ITEM = {
  id: 'e0000000-0000-4000-8000-000000000002',
  requestId: 'd0000000-0000-4000-8000-000000000001',
  kind: 'damaged_goods',
  description: 'La caja llegó abierta y faltaba una docena de facturas.',
  status: 'open',
  resolution: null,
  createdAt: '2026-09-27T12:00:00.123456Z',
  reporterId: 'f0000000-0000-4000-8000-00000000000a',
  reporterRole: 'merchant',
  reporterName: 'Panadería La Espiga',
};

describe('PR113-H06: getIncidentsQueue consume admin_list_incidents (CC-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lee con el cliente de sesión vía la RPC y nunca con service role ni SQL propio', async () => {
    const { rpc, from } = mockClient({});
    await getIncidentsQueue();
    expect(serverSupabase.createClient).toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[0]).toBe('admin_list_incidents');
    expect(from).not.toHaveBeenCalled();
  });

  it('la pestaña por defecto pide open y reviewing, primera página de 20', async () => {
    const { rpc } = mockClient({});
    await getIncidentsQueue();
    expect(rpc).toHaveBeenCalledWith('admin_list_incidents', {
      p_statuses: ['open', 'reviewing'],
      p_cursor_created_at: null,
      p_cursor_id: null,
      p_limit: 20,
    });
  });

  it('la pestaña cerrados pide resolved y dismissed; el tamaño se acota a 50', async () => {
    const { rpc } = mockClient({});
    await getIncidentsQueue({ tab: 'closed', pageSize: 500 });
    expect(rpc).toHaveBeenCalledWith('admin_list_incidents', {
      p_statuses: ['resolved', 'dismissed'],
      p_cursor_created_at: null,
      p_cursor_id: null,
      p_limit: 50,
    });
  });

  it('envía el cursor compuesto completo (createdAt con microsegundos + id)', async () => {
    const { rpc } = mockClient({});
    const cursor = { createdAt: '2026-09-27T12:00:00.123456Z', id: ITEM.id };
    await getIncidentsQueue({ cursor, pageSize: 10 });
    expect(rpc).toHaveBeenCalledWith('admin_list_incidents', {
      p_statuses: ['open', 'reviewing'],
      p_cursor_created_at: '2026-09-27T12:00:00.123456Z',
      p_cursor_id: ITEM.id,
      p_limit: 10,
    });
  });

  it('devuelve los ítems y el nextCursor compuesto de la RPC', async () => {
    const nextCursor = { createdAt: ITEM.createdAt, id: ITEM.id };
    mockClient({}, { data: { items: [ITEM], nextCursor }, error: null });

    const result = await getIncidentsQueue({ pageSize: 1 });

    expect(result).toEqual({ items: [ITEM], pageSize: 1, nextCursor });
  });

  it('no expone datos de contacto del destinatario', async () => {
    mockClient({}, { data: { items: [ITEM], nextCursor: null }, error: null });
    const result = await getIncidentsQueue();
    expect(JSON.stringify(result)).not.toMatch(CONTACT_COLUMNS);
  });

  it('propaga el error de la RPC para el error boundary', async () => {
    mockClient({}, { data: null, error: { message: 'AAL2_REQUIRED' } });
    await expect(getIncidentsQueue()).rejects.toThrow();
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

const ADMIN_ID = '90000000-0000-4000-8000-000000000001';
const TIE = '2026-09-27T12:00:00.123456Z';
const id = (suffix: string) => `e0000000-0000-4000-8000-000000000${suffix}`;

function seed(suffix: string, createdAt: string): FakeSeedIncident {
  return {
    incidentId: id(suffix),
    requestId: 'd0000000-0000-4000-8000-000000000001',
    reporterId: 'f0000000-0000-4000-8000-00000000000a',
    reporterRole: 'merchant',
    reporterName: 'Panadería La Espiga',
    kind: 'other',
    description: 'Demora en el retiro del pedido.',
    status: 'open',
    createdAt,
  };
}

/**
 * La RPC real vive en Postgres; acá `client.rpc('admin_list_incidents')` responde con el fake de dominio de CC-012,
 * que implementa el mismo keyset `created_at DESC, id DESC` con microsegundos. La feature no reimplementa el orden.
 */
function mockClientBackedByFake(incidents: readonly FakeSeedIncident[]) {
  const fake = createFakeRpcClient({
    settings: SETTINGS,
    initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
    initialIncidents: incidents,
  });
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn !== 'admin_list_incidents') throw new Error(`RPC inesperada: ${fn}`);
    const createdAt = args.p_cursor_created_at;
    const cursorId = args.p_cursor_id;
    const result = await fake.admin_list_incidents({
      statuses: args.p_statuses as ['open'],
      cursor:
        typeof createdAt === 'string' && typeof cursorId === 'string'
          ? { createdAt, id: cursorId }
          : null,
      ...(typeof args.p_limit === 'number' ? { limit: args.p_limit } : {}),
    });
    return result.ok ? { data: result.data, error: null } : { data: null, error: { message: result.code } };
  });
  vi.mocked(serverSupabase.createClient).mockResolvedValue({ rpc } as unknown as ServerClient);
  return rpc;
}

/** Recorre la bandeja como la persona: página → link «Siguiente» → searchParams → siguiente página. */
async function walkInbox(pageSize: number, maxPages = 10): Promise<string[]> {
  const seen: string[] = [];
  let cursor: IncidentsCursor | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await getIncidentsQueue({ tab: 'open', pageSize, ...(cursor ? { cursor } : {}) });
    seen.push(...result.items.map((item) => item.id));
    if (!result.nextCursor) return seen;
    const url = new URL(incidentsInboxHref('open', result.nextCursor), 'http://localhost');
    cursor = parseIncidentsSearchParams({
      tab: url.searchParams.get('tab') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
    }).cursor;
  }
  return seen;
}

describe('PR113-H06: keyset estable con createdAt empatado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // a02 y a01 tienen exactamente el mismo createdAt; a03 cae en el mismo milisegundo pero es posterior.
  const incidents = [
    seed('a00', '2026-09-27T11:00:00.000000Z'),
    seed('a01', TIE),
    seed('a02', TIE),
    seed('a03', '2026-09-27T12:00:00.123789Z'),
    seed('a04', '2026-09-27T13:00:00.000000Z'),
  ];
  const expected = [id('a04'), id('a03'), id('a02'), id('a01'), id('a00')];

  it.each([1, 2])(
    'con páginas de %i no pierde ni duplica incidentes y conserva created_at DESC, id DESC',
    async (pageSize) => {
      mockClientBackedByFake(incidents);

      const seen = await walkInbox(pageSize);

      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toEqual(expected);
    }
  );

  it('el cursor que viaja en la URL conserva el id además del timestamp', async () => {
    mockClientBackedByFake(incidents);
    const first = await getIncidentsQueue({ pageSize: 3 });
    expect(first.nextCursor).toEqual({ createdAt: TIE, id: id('a02') });

    const url = new URL(incidentsInboxHref('open', first.nextCursor ?? undefined), 'http://localhost');
    expect(parseIncidentsSearchParams({ cursor: url.searchParams.get('cursor') }).cursor).toEqual({
      createdAt: TIE,
      id: id('a02'),
    });
  });
});

const DETAIL_ROW = {
  id: 'e0000000-0000-4000-8000-000000000002',
  request_id: 'd0000000-0000-4000-8000-000000000001',
  kind: 'damaged_goods',
  description: 'La caja llegó abierta y faltaba una docena de facturas. '.repeat(5).trim(),
  status: 'open',
  resolution: null,
  created_at: '2026-09-27T12:00:00.123456+00:00',
  reporter: { display_name: 'Panadería La Espiga', role: 'merchant' },
  delivery_requests: {
    id: 'd0000000-0000-4000-8000-000000000001',
    merchant_id: 'f0000000-0000-4000-8000-00000000000a',
    published_at: '2026-09-27T10:00:00+00:00',
    matched_at: '2026-09-27T10:05:00+00:00',
    picked_up_at: '2026-09-27T10:20:00+00:00',
    delivered_at: null,
    cancelled_at: null,
    merchants: { profiles: { display_name: 'Panadería La Espiga', phone: '3865551234' } },
    delivery_request_contacts: { recipient_name: 'Juana Gómez', recipient_phone: '3865998877' },
  },
};

const OFFER_ROW = {
  courier_id: 'c0000000-0000-4000-8000-000000000003',
  couriers: { status: 'approved', profiles: { display_name: 'Diego Santillán', phone: '3865112233' } },
};

describe('T-124 DoD: getIncidentDetail — mediación sin datos del destinatario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve relato, partes del viaje y cronología', async () => {
    mockClient({
      incidents: { data: DETAIL_ROW, error: null },
      offers: { data: OFFER_ROW, error: null },
    });

    const detail = await getIncidentDetail(DETAIL_ROW.id);

    expect(detail).toEqual({
      id: DETAIL_ROW.id,
      requestId: DETAIL_ROW.request_id,
      kind: 'damaged_goods',
      description: DETAIL_ROW.description,
      status: 'open',
      resolution: null,
      createdAt: '2026-09-27T12:00:00.123456+00:00',
      reporterRole: 'merchant',
      reporterName: 'Panadería La Espiga',
      merchant: {
        id: 'f0000000-0000-4000-8000-00000000000a',
        name: 'Panadería La Espiga',
        phone: '3865551234',
      },
      courier: {
        id: 'c0000000-0000-4000-8000-000000000003',
        name: 'Diego Santillán',
        phone: '3865112233',
      },
      courierSuspended: false,
      timeline: {
        publishedAt: '2026-09-27T10:00:00+00:00',
        matchedAt: '2026-09-27T10:05:00+00:00',
        pickedUpAt: '2026-09-27T10:20:00+00:00',
        deliveredAt: null,
        cancelledAt: null,
      },
    });
  });

  it('marca courierSuspended cuando el repartidor ya está suspendido', async () => {
    mockClient({
      incidents: { data: DETAIL_ROW, error: null },
      offers: {
        data: { ...OFFER_ROW, couriers: { ...OFFER_ROW.couriers, status: 'suspended' } },
        error: null,
      },
    });
    const detail = await getIncidentDetail(DETAIL_ROW.id);
    expect(detail?.courierSuspended).toBe(true);
  });

  it('busca la oferta aceptada de esa solicitud para identificar al repartidor', async () => {
    const { calls } = mockClient({
      incidents: { data: DETAIL_ROW, error: null },
      offers: { data: OFFER_ROW, error: null },
    });
    await getIncidentDetail(DETAIL_ROW.id);

    const offerFilters = callsOf(calls, 'offers', 'eq').map((call) => call.args);
    expect(offerFilters).toContainEqual(['request_id', DETAIL_ROW.request_id]);
    expect(offerFilters).toContainEqual(['status', 'accepted']);
  });

  it('sin repartidor asignado devuelve courier null', async () => {
    mockClient({
      incidents: { data: DETAIL_ROW, error: null },
      offers: { data: null, error: null },
    });
    const detail = await getIncidentDetail(DETAIL_ROW.id);
    expect(detail?.courier).toBeNull();
    expect(detail?.courierSuspended).toBe(false);
  });

  it('no pide ni devuelve datos de contacto del destinatario aunque la fila los traiga', async () => {
    const { calls } = mockClient({
      incidents: { data: DETAIL_ROW, error: null },
      offers: { data: OFFER_ROW, error: null },
    });

    const detail = await getIncidentDetail(DETAIL_ROW.id);

    for (const call of calls.filter((entry) => entry.method === 'select')) {
      expect(String(call.args[0])).not.toMatch(CONTACT_COLUMNS);
    }
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('Juana Gómez');
    expect(serialized).not.toContain('3865998877');
  });

  it('usa el cliente de sesión y devuelve null si el incidente no existe', async () => {
    mockClient({ incidents: { data: null, error: null } });
    await expect(getIncidentDetail(DETAIL_ROW.id)).resolves.toBeNull();
    expect(serverSupabase.createClient).toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('un id que no es uuid devuelve null sin consultar la base', async () => {
    const { from } = mockClient({ incidents: { data: DETAIL_ROW, error: null } });
    await expect(getIncidentDetail('no-uuid')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('propaga el error de base', async () => {
    mockClient({ incidents: { data: null, error: { message: 'boom' } } });
    await expect(getIncidentDetail(DETAIL_ROW.id)).rejects.toThrow();
  });
});
