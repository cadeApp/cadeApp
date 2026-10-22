import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Result = { data: unknown; error: { message: string } | null };
const tables: Record<string, Result> = {};
const selects: Record<string, string> = {};
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
let rpcResult: Result = { data: { items: [], nextCursor: null }, error: null };

function builder(table: string) {
  const result = () => tables[table] ?? { data: null, error: null };
  const chain = {
    select(columns: string) {
      selects[table] = columns;
      return chain;
    },
    eq() {
      return chain;
    },
    order() {
      return chain;
    },
    maybeSingle() {
      return Promise.resolve(result());
    },
    then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(result()).then(resolve, reject);
    },
  };
  return chain;
}

vi.mock('@/server/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => builder(table),
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return rpcResult;
    },
  }),
}));

const { getAdminTripDetail, getAdminTrips } = await import('./queries');

const REQUEST_ID = '00000000-0000-4000-8000-000000370001';

function seedDelivered() {
  tables.delivery_requests = {
    data: {
      id: REQUEST_ID,
      status: 'delivered',
      created_at: '2026-10-22T03:00:00+00:00',
      published_at: '2026-10-22T03:00:00+00:00',
      matched_at: '2026-10-22T03:10:00+00:00',
      picked_up_at: '2026-10-22T03:20:00+00:00',
      delivered_at: '2026-10-22T04:00:00+00:00',
      cancelled_at: null,
      merchant_id: '00000000-0000-4000-8000-0000000370b1',
      accepted_offer_id: '00000000-0000-4000-8000-0000000380a1',
      merchants: { business_name: '  ', profiles: { display_name: 'Comercio Perfil', phone: '3865111111' } },
    },
    error: null,
  };
  tables.delivery_request_drops = {
    data: [
      { position: 1, status: 'delivered', delivered_at: '2026-10-22T03:50:00+00:00', failed_reason: null, zones: { name: 'Centro' } },
      { position: 2, status: 'failed', delivered_at: null, failed_reason: 'No responde', zones: { name: 'Sur' } },
    ],
    error: null,
  };
  tables.request_cancellation_reasons = {
    data: [
      {
        id: '00000000-0000-4000-8000-0000000371a1',
        action: 'courier_cancel_match',
        reason: 'Emergencia',
        created_at: '2026-10-22T03:05:00+00:00',
        actor: { display_name: 'Juan', role: 'courier' },
      },
      {
        id: '00000000-0000-4000-8000-0000000371a2',
        action: 'acción_futura',
        reason: 'x',
        created_at: '2026-10-22T03:06:00+00:00',
        actor: null,
      },
    ],
    error: null,
  };
  tables.incidents = {
    data: [{ id: '00000000-0000-4000-8000-0000000372a1', kind: 'other', status: 'open', created_at: '2026-10-22T04:10:00+00:00' }],
    error: null,
  };
  tables.offers = {
    data: { courier_id: '00000000-0000-4000-8000-0000000370c1', couriers: { profiles: { display_name: 'Repartidor', phone: null } } },
    error: null,
  };
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  for (const key of Object.keys(selects)) delete selects[key];
  rpcCalls.length = 0;
  rpcResult = { data: { items: [], nextCursor: null }, error: null };
});

describe('T-410: getAdminTrips', () => {
  it('llama a admin_list_trips con «Con problemas» por defecto y límite acotado', async () => {
    const result = await getAdminTrips({ pageSize: 500 });

    expect(rpcCalls).toEqual([
      {
        fn: 'admin_list_trips',
        args: { p_filter: 'problems', p_cursor_created_at: null, p_cursor_id: null, p_limit: 50 },
      },
    ]);
    expect(result).toEqual({ items: [], pageSize: 50, nextCursor: null });
  });

  it('un error de la RPC se propaga solo con el código de dominio', async () => {
    rpcResult = { data: null, error: { message: 'AAL2_REQUIRED', code: 'P0001' } as { message: string } };
    await expect(getAdminTrips({ filter: 'all' })).rejects.toThrow('ADMIN_TRIPS_AAL2_REQUIRED');
  });
});

describe('T-410: getAdminTripDetail', () => {
  it('arma el detalle con partes, entregas, eventos conocidos e incidentes', async () => {
    seedDelivered();

    const trip = await getAdminTripDetail(REQUEST_ID);

    expect(trip).toMatchObject({
      id: REQUEST_ID,
      code: 'REQ-00000000',
      status: 'delivered',
      merchant: { name: 'Comercio Perfil', phone: '3865111111' },
      courier: { name: 'Repartidor', phone: null },
      drops: [
        { position: 1, zoneName: 'Centro', status: 'delivered', failedReason: null },
        { position: 2, zoneName: 'Sur', status: 'failed', failedReason: 'No responde' },
      ],
      incidents: [{ kind: 'other', status: 'open' }],
    });
    expect(trip?.events).toEqual([
      {
        id: '00000000-0000-4000-8000-0000000371a1',
        action: 'courier_cancel_match',
        reason: 'Emergencia',
        createdAt: '2026-10-22T03:05:00+00:00',
        actorName: 'Juan',
        actorRole: 'courier',
      },
    ]);
  });

  it('id inválido, solicitud inexistente o borrador: null', async () => {
    expect(await getAdminTripDetail('no-es-uuid')).toBeNull();

    tables.delivery_requests = { data: null, error: null };
    expect(await getAdminTripDetail(REQUEST_ID)).toBeNull();

    seedDelivered();
    tables.delivery_requests = {
      data: { ...(tables.delivery_requests?.data as object), status: 'draft' },
      error: null,
    };
    expect(await getAdminTripDetail(REQUEST_ID)).toBeNull();
  });

  it('un error de lectura no se traga: lanza sin detalles de la base', async () => {
    seedDelivered();
    tables.request_cancellation_reasons = { data: null, error: { message: 'permission denied' } };
    await expect(getAdminTripDetail(REQUEST_ID)).rejects.toThrow('ADMIN_TRIP_DETAIL_READ_FAILED');
  });

  it('privacidad: ninguna lectura pide columnas de contacto del destinatario', async () => {
    seedDelivered();
    await getAdminTripDetail(REQUEST_ID);

    const tokens = new Set(Object.values(selects).join(' ').split(/[^a-z_]+/));
    for (const forbidden of [
      'dropoff_address',
      'pickup_address',
      'dropoff_lat',
      'dropoff_lng',
      'pickup_lat',
      'pickup_lng',
      'pin',
      'notes',
      'delivery_notes',
      'cash_change_amount',
    ]) {
      expect(tokens.has(forbidden), forbidden).toBe(false);
    }
    expect([...tokens].filter((token) => token.startsWith('recipient'))).toEqual([]);
  });

  it('privacidad: el código de la feature nunca lee las tablas de contactos', () => {
    const dir = path.join(process.cwd(), 'src/features/admin-trips');
    const sources = fs
      .readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file))
      .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
      .join('\n');

    expect(sources).not.toContain('delivery_request_contacts');
    expect(sources).not.toContain('delivery_request_drop_contacts');
  });
});
