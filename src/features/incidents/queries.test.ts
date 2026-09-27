import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import { getIncidentDetail, getIncidentsQueue } from './queries';

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

/** Cliente simulado que registra cada llamada del query builder sin fijar su orden. */
function mockClient(resultsByTable: Record<string, { data: unknown; error: unknown }>) {
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
  vi.mocked(serverSupabase.createClient).mockResolvedValue({ from } as unknown as ServerClient);
  return { from, calls };
}

function callsOf(calls: readonly RecordedCall[], table: string, method: string) {
  return calls.filter((call) => call.table === table && call.method === method);
}

const CONTACT_COLUMNS = /delivery_request_contacts|recipient|dropoff_address|pickup_address|_lat|_lng/i;

const INCIDENT_ROW = {
  id: 'e0000000-0000-4000-8000-000000000002',
  request_id: 'd0000000-0000-4000-8000-000000000001',
  kind: 'damaged_goods',
  description: 'La caja llegó abierta y faltaba una docena de facturas. '.repeat(5).trim(),
  status: 'open',
  resolution: null,
  created_at: '2026-09-27T12:00:00.000Z',
  reporter: { display_name: 'Panadería La Espiga', role: 'merchant' },
};

describe('T-124 DoD: getIncidentsQueue — el reporte llega a la bandeja A05', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lee incidents con el cliente de sesión (RLS del admin) y nunca con service role', async () => {
    mockClient({ incidents: { data: [], error: null } });
    await getIncidentsQueue();
    expect(serverSupabase.createClient).toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('la pestaña por defecto trae los abiertos (open y reviewing), incluido un reporte recién creado', async () => {
    const { calls } = mockClient({ incidents: { data: [INCIDENT_ROW], error: null } });

    const result = await getIncidentsQueue();

    expect(callsOf(calls, 'incidents', 'in')[0]?.args).toEqual(['status', ['open', 'reviewing']]);
    expect(result.items.map((item) => item.id)).toEqual([INCIDENT_ROW.id]);
  });

  it('la pestaña cerrados trae resolved y dismissed', async () => {
    const { calls } = mockClient({ incidents: { data: [], error: null } });
    await getIncidentsQueue({ tab: 'closed' });
    expect(callsOf(calls, 'incidents', 'in')[0]?.args).toEqual(['status', ['resolved', 'dismissed']]);
  });

  it('pagina server-side por created_at descendente con limit(pageSize + 1) y sin range()', async () => {
    const { calls } = mockClient({ incidents: { data: [], error: null } });
    await getIncidentsQueue({ pageSize: 10 });

    expect(callsOf(calls, 'incidents', 'order')[0]?.args).toEqual([
      'created_at',
      { ascending: false },
    ]);
    expect(callsOf(calls, 'incidents', 'limit')[0]?.args).toEqual([11]);
    expect(callsOf(calls, 'incidents', 'range')).toHaveLength(0);
  });

  it('aplica el cursor con lt(created_at) y acota a 50 por página (20 por defecto)', async () => {
    const first = mockClient({ incidents: { data: [], error: null } });
    await getIncidentsQueue({ cursor: '2026-09-27T12:00:00.000Z', pageSize: 500 });
    expect(callsOf(first.calls, 'incidents', 'lt')[0]?.args).toEqual([
      'created_at',
      '2026-09-27T12:00:00.000Z',
    ]);
    expect(callsOf(first.calls, 'incidents', 'limit')[0]?.args).toEqual([51]);

    const second = mockClient({ incidents: { data: [], error: null } });
    await getIncidentsQueue();
    expect(callsOf(second.calls, 'incidents', 'limit')[0]?.args).toEqual([21]);
  });

  it('no selecciona datos de contacto del destinatario ni direcciones', async () => {
    const { calls } = mockClient({ incidents: { data: [], error: null } });
    await getIncidentsQueue();
    const columns = String(callsOf(calls, 'incidents', 'select')[0]?.args[0]);
    expect(columns).not.toMatch(CONTACT_COLUMNS);
  });

  it('mapea el item con extracto acotado, rol del reporte y nextCursor', async () => {
    const second = { ...INCIDENT_ROW, id: 'e0000000-0000-4000-8000-000000000003', created_at: '2026-09-27T11:00:00.000Z' };
    mockClient({ incidents: { data: [INCIDENT_ROW, second], error: null } });

    const result = await getIncidentsQueue({ pageSize: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: INCIDENT_ROW.id,
      requestId: INCIDENT_ROW.request_id,
      kind: 'damaged_goods',
      status: 'open',
      createdAt: INCIDENT_ROW.created_at,
      reporterRole: 'merchant',
      reporterName: 'Panadería La Espiga',
    });
    expect(result.items[0]?.excerpt.length).toBeLessThanOrEqual(140);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextCursor).toBe(INCIDENT_ROW.created_at);
  });

  it('propaga el error de base para el error boundary', async () => {
    mockClient({ incidents: { data: null, error: { message: 'boom' } } });
    await expect(getIncidentsQueue()).rejects.toThrow();
  });
});

const DETAIL_ROW = {
  ...INCIDENT_ROW,
  delivery_requests: {
    id: INCIDENT_ROW.request_id,
    merchant_id: 'f0000000-0000-4000-8000-00000000000a',
    published_at: '2026-09-27T10:00:00.000Z',
    matched_at: '2026-09-27T10:05:00.000Z',
    picked_up_at: '2026-09-27T10:20:00.000Z',
    delivered_at: null,
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

    const detail = await getIncidentDetail(INCIDENT_ROW.id);

    expect(detail).toMatchObject({
      id: INCIDENT_ROW.id,
      requestId: INCIDENT_ROW.request_id,
      description: INCIDENT_ROW.description,
      reporterRole: 'merchant',
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
        publishedAt: '2026-09-27T10:00:00.000Z',
        matchedAt: '2026-09-27T10:05:00.000Z',
        pickedUpAt: '2026-09-27T10:20:00.000Z',
        deliveredAt: null,
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
    const detail = await getIncidentDetail(INCIDENT_ROW.id);
    expect(detail?.courierSuspended).toBe(true);
  });

  it('busca la oferta aceptada de esa solicitud para identificar al repartidor', async () => {
    const { calls } = mockClient({
      incidents: { data: DETAIL_ROW, error: null },
      offers: { data: OFFER_ROW, error: null },
    });
    await getIncidentDetail(INCIDENT_ROW.id);

    const offerFilters = callsOf(calls, 'offers', 'eq').map((call) => call.args);
    expect(offerFilters).toContainEqual(['request_id', INCIDENT_ROW.request_id]);
    expect(offerFilters).toContainEqual(['status', 'accepted']);
  });

  it('sin repartidor asignado devuelve courier null', async () => {
    mockClient({
      incidents: { data: DETAIL_ROW, error: null },
      offers: { data: null, error: null },
    });
    const detail = await getIncidentDetail(INCIDENT_ROW.id);
    expect(detail?.courier).toBeNull();
    expect(detail?.courierSuspended).toBe(false);
  });

  it('no pide ni devuelve datos de contacto del destinatario aunque la fila los traiga', async () => {
    const { calls } = mockClient({
      incidents: { data: DETAIL_ROW, error: null },
      offers: { data: OFFER_ROW, error: null },
    });

    const detail = await getIncidentDetail(INCIDENT_ROW.id);

    for (const call of calls.filter((entry) => entry.method === 'select')) {
      expect(String(call.args[0])).not.toMatch(CONTACT_COLUMNS);
    }
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('Juana Gómez');
    expect(serialized).not.toContain('3865998877');
  });

  it('usa el cliente de sesión y devuelve null si el incidente no existe', async () => {
    mockClient({ incidents: { data: null, error: null } });
    await expect(getIncidentDetail(INCIDENT_ROW.id)).resolves.toBeNull();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('propaga el error de base', async () => {
    mockClient({ incidents: { data: null, error: { message: 'boom' } } });
    await expect(getIncidentDetail(INCIDENT_ROW.id)).rejects.toThrow();
  });
});
