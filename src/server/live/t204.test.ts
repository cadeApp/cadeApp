import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getAvailableRequestsLiveServer,
  getRequestOffersLiveServer,
  getTripLiveStateServer,
} from './t204';
import * as serverSupabase from '@/server/supabase/server';
import * as tripsRpc from '@/server/rpc/trips';
import { ok, err } from '@/domain';
import { liveFeedResponseSchema } from '@/lib/live-contracts';

vi.mock('@/server/supabase/server');
vi.mock('@/server/rpc/trips');

describe('src/server/live/t204.ts: Server-side Live Data Helpers', () => {
  const mockUser = { id: '00000000-0000-0000-0000-000000000001' };
  const validUuid = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  interface MockCallLog {
    select: unknown[][];
    eq: unknown[][];
    order: unknown[][];
    limit: unknown[][];
    or: unknown[][];
    in: unknown[][];
    maybeSingle: unknown[][];
  }

  interface MockQueryResult<T> {
    readonly data: T;
    readonly error: unknown;
  }

  interface MockBuilder<T> {
    _calls: MockCallLog;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: MockQueryResult<T>) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise<unknown>;
  }

  function createMockQueryBuilder<T>(
    resolvedData: T,
    resolvedError: unknown = null
  ): MockBuilder<T> {
    const calls: MockCallLog = {
      select: [],
      eq: [],
      order: [],
      limit: [],
      or: [],
      in: [],
      maybeSingle: [],
    };

    const builder: MockBuilder<T> = {
      _calls: calls,
      select: vi.fn((...args: unknown[]) => {
        calls.select.push(args);
        return builder;
      }),
      eq: vi.fn((...args: unknown[]) => {
        calls.eq.push(args);
        return builder;
      }),
      order: vi.fn((...args: unknown[]) => {
        calls.order.push(args);
        return builder;
      }),
      limit: vi.fn((...args: unknown[]) => {
        calls.limit.push(args);
        return builder;
      }),
      or: vi.fn((...args: unknown[]) => {
        calls.or.push(args);
        return builder;
      }),
      in: vi.fn((...args: unknown[]) => {
        calls.in.push(args);
        return builder;
      }),
      maybeSingle: vi.fn((...args: unknown[]) => {
        calls.maybeSingle.push(args);
        return Promise.resolve({ data: resolvedData, error: resolvedError });
      }),
      then: (
        resolve: (value: MockQueryResult<T>) => unknown,
        reject?: (reason: unknown) => unknown
      ): Promise<unknown> => {
        return Promise.resolve({ data: resolvedData, error: resolvedError }).then(resolve, reject);
      },
    };

    return builder;
  }

  function makeRequestRow(i: number) {
    const padded = String(i).padStart(12, '0');
    const id = `00000000-0000-0000-0000-${padded}`;
    const mins = String(59 - (i % 60)).padStart(2, '0');
    const createdAt = `2026-09-26T12:${mins}:00.000Z`;
    return {
      id,
      created_at: createdAt,
      approx_distance_m: 1000,
      package_type: 'chico',
      recipient_payment_method: 'cash',
      needs_change: false,
      cash_change_amount: null,
      notes: null,
      published_at: createdAt,
      expires_at: null,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Aguilares' },
    };
  }

  function makeOfferRow(i: number, reqId: string) {
    const padded = String(i).padStart(12, '0');
    const id = `00000000-0000-0000-0000-${padded}`;
    const mins = String(59 - (i % 60)).padStart(2, '0');
    const createdAt = `2026-09-26T12:${mins}:00.000Z`;
    return {
      id,
      request_id: reqId,
      courier_id: `10000000-0000-0000-0000-${padded}`,
      amount_ars: 1500 + i,
      eta_minutes: 10,
      message: null,
      status: 'pending',
      created_at: createdAt,
    };
  }

  // CC-016: forma exacta de la salida de `get_request_offer_couriers`.
  function makeCourierProjection(i: number) {
    return {
      courierId: `10000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      displayName: `Repartidor ${i}`,
      vehicleType: 'moto',
      licenseStatus: 'verified',
      insuranceStatus: 'none',
      docLevel: 1,
    };
  }

  function makeCouriersRpc(requestId: string, indexes: readonly number[]) {
    return vi.fn().mockResolvedValue({
      data: { requestId, couriers: indexes.map(makeCourierProjection) },
      error: null,
    });
  }

  function makeOwnedRequestBuilder() {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: validUuid, merchant_id: mockUser.id },
            error: null,
          }),
        }),
      }),
    };
  }

  function mockMerchantClient(offerRows: readonly unknown[], rpc: ReturnType<typeof vi.fn>) {
    const offersBuilder = createMockQueryBuilder(offerRows);
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return makeOwnedRequestBuilder();
        if (table === 'offers') return offersBuilder;
        return {};
      }),
      rpc,
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    return offersBuilder;
  }

  describe('3.1 getAvailableRequestsLiveServer', () => {
    it('retorna 401 si no hay usuario autenticado', async () => {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.error).toBe('UNAUTHENTICATED');
      }
    });

    it('retorna 500 si falla la consulta de delivery_requests', async () => {
      const reqBuilder = createMockQueryBuilder(null, new Error('DB query error'));
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockReturnValue(reqBuilder),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(500);
        expect(result.error).toBe('DATABASE_ERROR');
      }
    });

    it('retorna [] válido y nextCursor null si hay 0 solicitudes publicadas', async () => {
      const reqBuilder = createMockQueryBuilder([]);
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockReturnValue(reqBuilder),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ data: [], nextCursor: null });
      }
    });

    it('retorna 500 si falla la consulta de offers', async () => {
      const reqBuilder = createMockQueryBuilder([makeRequestRow(1)]);
      const offersBuilder = createMockQueryBuilder(null, new Error('Offers query error'));
      const dropsBuilder = createMockQueryBuilder([]);
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        if (table === 'delivery_request_drops') return dropsBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(500);
        expect(result.error).toBe('DATABASE_ERROR');
      }
    });

    it('happy path: mapea solicitudes y ofertas pendientes del courier', async () => {
      const row = makeRequestRow(1);
      const reqBuilder = createMockQueryBuilder([row]);
      const offersBuilder = createMockQueryBuilder([{ request_id: row.id, amount_ars: 1800 }]);
      const dropsBuilder = createMockQueryBuilder([
        {
          id: 'drop-1',
          request_id: row.id,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: true,
          approx_distance_m: 1000,
          dropoff_zone: { name: 'Aguilares' },
        },
      ]);
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        if (table === 'delivery_request_drops') return dropsBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.data[0]?.hasMyOffer).toBe(true);
        expect(result.data.data[0]?.myOfferAmountArs).toBe(1800);
        expect(result.data.data[0]?.approxDistanceKm).toBe('1,0');
        expect(result.data.nextCursor).toBeNull();
      }
    });

    it('T-363: sin approx_distance_m la vía en vivo devuelve approxDistanceKm null (no inventa 1,0)', async () => {
      const row = { ...makeRequestRow(1), approx_distance_m: null };
      const reqBuilder = createMockQueryBuilder([row]);
      const offersBuilder = createMockQueryBuilder([]);
      const dropsBuilder = createMockQueryBuilder([
        {
          id: 'drop-1',
          request_id: row.id,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: null,
          dropoff_zone: { name: 'Aguilares' },
        },
      ]);
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        if (table === 'delivery_request_drops') return dropsBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.data[0]?.approxDistanceKm).toBeNull();
      }
    });

    it('T-342 D3: no lee ni transporta indicaciones ni monto exacto de cambio antes del match', async () => {
      const row = {
        ...makeRequestRow(1),
        needs_change: true,
        cash_change_amount: 5000,
        notes: 'Portón negro, tocar timbre 2B',
      };
      const reqBuilder = createMockQueryBuilder([row]);
      const offersBuilder = createMockQueryBuilder([]);
      const dropsBuilder = createMockQueryBuilder([
        {
          id: 'drop-1',
          request_id: row.id,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: true,
          approx_distance_m: 1000,
          dropoff_zone: { name: 'Aguilares' },
        },
      ]);
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        if (table === 'delivery_request_drops') return dropsBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();

      const projection = String(reqBuilder._calls.select[0]?.[0] ?? '');
      const columns = projection.split(/[\s,]+/).filter(Boolean);
      expect(columns).not.toContain('notes');
      expect(columns).not.toContain('cash_change_amount');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const first = result.data.data[0];
      if (!first) throw new Error('First request should be defined');
      expect(first).not.toHaveProperty('notes');
      expect(first).not.toHaveProperty('cashChangeAmount');
      expect(first.needsChange).toBe(true);
      const serialized = JSON.stringify(result.data);
      expect(serialized).not.toContain('Portón negro');
      expect(serialized).not.toContain('5000');
    });

    function mockFeedClient(rows: readonly unknown[]) {
      const reqBuilder = createMockQueryBuilder(rows);
      const offersBuilder = createMockQueryBuilder([]);
      const dropsRows = (
        rows as Array<{
          id?: string;
          package_type?: string;
          recipient_payment_method?: string;
          needs_change?: boolean;
          approx_distance_m?: number;
        }>
      ).map((r, i) => ({
        id: `drop-${r.id ?? i}`,
        request_id: r.id ?? `req-${i}`,
        position: 1,
        package_type: r.package_type ?? 'chico',
        recipient_payment_method: r.recipient_payment_method ?? 'cash',
        needs_change: Boolean(r.needs_change),
        approx_distance_m: r.approx_distance_m ?? 1000,
        dropoff_zone: { name: 'Aguilares' },
      }));
      const dropsBuilder = createMockQueryBuilder(dropsRows);
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'delivery_requests') return reqBuilder;
          if (table === 'offers') return offersBuilder;
          if (table === 'delivery_request_drops') return dropsBuilder;
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    }

    it('T-343: con los valores reales de la base la respuesta pasa liveFeedResponseSchema sin traducirlos', async () => {
      const combos = (['sobre', 'chico', 'mediano', 'grande'] as const).flatMap((packageType) =>
        (['cash', 'transfer', 'to_agree'] as const).map((method) => [packageType, method] as const)
      );
      const rows = combos.map(([packageType, method], i) => ({
        ...makeRequestRow(i + 1),
        package_type: packageType,
        recipient_payment_method: method,
      }));
      mockFeedClient(rows);

      const result = await getAvailableRequestsLiveServer();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const parsed = liveFeedResponseSchema.parse(result.data);
      expect(parsed.data.map((r) => [r.packageType, r.recipientPaymentMethod])).toEqual(combos);
    });

    it('T-343: un valor fuera del dominio canónico no se fuerza: responde 500', async () => {
      mockFeedClient([{ ...makeRequestRow(1), package_type: 'small' }]);

      const result = await getAvailableRequestsLiveServer();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(500);
        expect(result.error).toBe('DATABASE_ERROR');
      }
    });

    it('A & E: Feed con 51 filas -> 50 resultados + nextCursor de fila 50 y hasMyOffer consulta SOLO 50 ids', async () => {
      const rows51 = Array.from({ length: 51 }, (_, i) => makeRequestRow(i + 1));
      const reqBuilder = createMockQueryBuilder(rows51);
      const offersBuilder = createMockQueryBuilder([]);
      const dropsBuilder = createMockQueryBuilder(
        rows51.map((r) => ({
          id: `drop-${r.id}`,
          request_id: r.id,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: Boolean(r.needs_change),
          approx_distance_m: 1000,
          dropoff_zone: { name: 'Aguilares' },
        }))
      );

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        if (table === 'delivery_request_drops') return dropsBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toHaveLength(50);
        const row50 = rows51.at(49);
        const row51 = rows51.at(50);
        expect(row50).toBeDefined();
        expect(row51).toBeDefined();
        if (!row50 || !row51) throw new Error('Fixture de 51 filas inválido');

        expect(result.data.nextCursor).toEqual({
          createdAt: row50.created_at,
          id: row50.id,
        });

        // Test E: hasMyOffer consulta SOLO los 50 requestIds devueltos, jamás el #51
        const requestedOfferIds = offersBuilder._calls.in[0]?.[1] as string[];
        expect(requestedOfferIds).toHaveLength(50);
        expect(requestedOfferIds).not.toContain(row51.id);
      }
    });

    it('B: Feed segunda página -> spy demuestra order(created_at), order(id), limit(51) y .or(...) exacto', async () => {
      const row = makeRequestRow(1);
      const reqBuilder = createMockQueryBuilder([row]);
      const offersBuilder = createMockQueryBuilder([]);
      const dropsBuilder = createMockQueryBuilder([
        {
          id: 'drop-1',
          request_id: row.id,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: true,
          approx_distance_m: 1000,
          dropoff_zone: { name: 'Aguilares' },
        },
      ]);

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        if (table === 'delivery_request_drops') return dropsBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const cursor = {
        createdAt: '2026-09-26T12:00:00.000Z',
        id: validUuid,
      };

      await getAvailableRequestsLiveServer(cursor);

      expect(reqBuilder._calls.order).toEqual([
        ['created_at', { ascending: false }],
        ['id', { ascending: false }],
      ]);
      expect(reqBuilder._calls.limit).toEqual([[51]]);
      expect(reqBuilder._calls.or).toEqual([
        [
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
        ],
      ]);
    });

    it('PR318-H05: responde 500 si drops_count = 1 pero delivery_request_drops devuelve vacío', async () => {
      const row = {
        ...makeRequestRow(1),
        drops_count: 1,
      };
      const reqBuilder = createMockQueryBuilder([row]);
      const offersBuilder = createMockQueryBuilder([]);
      const dropsBuilder = createMockQueryBuilder([]);

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'delivery_requests') return reqBuilder;
          if (table === 'offers') return offersBuilder;
          if (table === 'delivery_request_drops') return dropsBuilder;
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(500);
        expect(result.error).toBe('DATABASE_ERROR');
      }
    });

    it('PR318-H05: responde 500 si drops_count > 1 pero delivery_request_drops devuelve vacío', async () => {
      const row = {
        ...makeRequestRow(1),
        drops_count: 3,
      };
      const reqBuilder = createMockQueryBuilder([row]);
      const offersBuilder = createMockQueryBuilder([]);
      const dropsBuilder = createMockQueryBuilder([]);

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'delivery_requests') return reqBuilder;
          if (table === 'offers') return offersBuilder;
          if (table === 'delivery_request_drops') return dropsBuilder;
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(500);
        expect(result.error).toBe('DATABASE_ERROR');
      }
    });

    it('PR318-H05: responde con éxito cuando parent tiene columnas legacy nulas y deriva de drops', async () => {
      const reqId = '22222222-2222-2222-2222-222222222222';
      const row = {
        ...makeRequestRow(1),
        id: reqId,
        drops_count: 2,
        package_type: null,
        recipient_payment_method: null,
        needs_change: null,
        dropoff_zone: null,
      };
      const dropRows = [
        {
          id: 'drop-live-1',
          request_id: reqId,
          position: 1,
          approx_distance_m: 1200,
          package_type: 'mediano',
          recipient_payment_method: 'transfer',
          needs_change: false,
          dropoff_zone: { name: 'Barrio Norte' },
        },
        {
          id: 'drop-live-2',
          request_id: reqId,
          position: 2,
          approx_distance_m: 1800,
          package_type: 'grande',
          recipient_payment_method: 'cash',
          needs_change: true,
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ];
      const reqBuilder = createMockQueryBuilder([row]);
      const offersBuilder = createMockQueryBuilder([]);
      const dropsBuilder = createMockQueryBuilder(dropRows);

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'delivery_requests') return reqBuilder;
          if (table === 'offers') return offersBuilder;
          if (table === 'delivery_request_drops') return dropsBuilder;
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(true);
      if (result.ok) {
        const item = result.data.data[0];
        expect(item?.packageType).toBe('mediano');
        expect(item?.recipientPaymentMethod).toBe('transfer');
        expect(item?.needsChange).toBe(false);
        expect(item?.dropoffZoneName).toBe('Barrio Norte');
        expect(item?.dropsCount).toBe(2);
        expect(item?.drops).toHaveLength(2);
      }
    });
  });

  describe('3.2 getRequestOffersLiveServer', () => {
    it('retorna 400 si el requestId no es un UUID válido', async () => {
      const result = await getRequestOffersLiveServer('not-a-uuid');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.error).toBe('INVALID_REQUEST_ID');
      }
    });

    it('retorna 401 si no hay usuario autenticado', async () => {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
      }
    });

    it('retorna 404 si la solicitud no pertenece al merchant autenticado', async () => {
      const otherMerchantId = '99999999-9999-9999-9999-999999999999';

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: validUuid, merchant_id: otherMerchantId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'offers') {
          return createMockQueryBuilder([]);
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(404);
        expect(result.error).toBe('NOT_FOUND');
      }
      expect(mockFrom).not.toHaveBeenCalledWith('offers');
    });

    it('happy path: retorna ofertas de la solicitud perteneciente al merchant con nextCursor null', async () => {
      const offer = makeOfferRow(1, validUuid);
      const reqBuilder = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: validUuid, merchant_id: mockUser.id },
              error: null,
            }),
          }),
        }),
      };
      const offersBuilder = createMockQueryBuilder([offer]);
      const couriersRpc = makeCouriersRpc(validUuid, [1]);

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
        rpc: couriersRpc,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getRequestOffersLiveServer(validUuid);
      expect(couriersRpc).toHaveBeenCalledExactlyOnceWith('get_request_offer_couriers', {
        p_request_id: validUuid,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.data[0]).toMatchObject({
          courierName: 'Repartidor 1',
          amountArs: 1501,
          vehicleType: 'moto',
          licenseStatus: 'verified',
          insuranceStatus: 'none',
          docLevel: 1,
        });
        expect(result.data.nextCursor).toBeNull();
      }
    });

    it('C: Offers con 51 filas -> 50 + nextCursor', async () => {
      const offers51 = Array.from({ length: 51 }, (_, i) => makeOfferRow(i + 1, validUuid));
      const reqBuilder = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: validUuid, merchant_id: mockUser.id },
              error: null,
            }),
          }),
        }),
      };
      const offersBuilder = createMockQueryBuilder(offers51);

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
        rpc: makeCouriersRpc(
          validUuid,
          offers51.map((_, i) => i + 1)
        ),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toHaveLength(50);
        const offer50 = offers51.at(49);
        expect(offer50).toBeDefined();
        if (!offer50) throw new Error('Fixture de 51 ofertas inválido');

        expect(result.data.nextCursor).toEqual({
          createdAt: offer50.created_at,
          id: offer50.id,
        });
      }
    });

    it('D: Offers segunda página -> .or(...) exacto con order y limit', async () => {
      const reqBuilder = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: validUuid, merchant_id: mockUser.id },
              error: null,
            }),
          }),
        }),
      };
      const offersBuilder = createMockQueryBuilder([makeOfferRow(1, validUuid)]);

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const cursor = {
        createdAt: '2026-09-26T12:00:00.000Z',
        id: validUuid,
      };

      await getRequestOffersLiveServer(validUuid, cursor);

      expect(offersBuilder._calls.order).toEqual([
        ['created_at', { ascending: false }],
        ['id', { ascending: false }],
      ]);
      expect(offersBuilder._calls.limit).toEqual([[51]]);
      expect(offersBuilder._calls.or).toEqual([
        [
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
        ],
      ]);
    });

    it('T-365: filtra por status=pending inmediatamente tras request_id y antes de order/limit', async () => {
      const reqBuilder = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: validUuid, merchant_id: mockUser.id },
              error: null,
            }),
          }),
        }),
      };
      const offersBuilder = createMockQueryBuilder([makeOfferRow(1, validUuid)]);
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return offersBuilder;
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
        rpc: makeCouriersRpc(validUuid, [1]),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      await getRequestOffersLiveServer(validUuid);

      expect(offersBuilder._calls.eq).toEqual([
        ['request_id', validUuid],
        ['status', 'pending'],
      ]);
    });

    it('T-365: filtra funcionalmente 51+ ofertas mixtas y calcula nextCursor conforme solo pending', async () => {
      const reqBuilder = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: validUuid, merchant_id: mockUser.id },
              error: null,
            }),
          }),
        }),
      };

      // 10 ofertas no pending (cancelled, rejected, expired, withdrawn) con timestamps más recientes
      const nonPendingOffers = Array.from({ length: 10 }, (_, i) => ({
        id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
        request_id: validUuid,
        courier_id: `10000000-0000-0000-0000-${String(100 + i + 1).padStart(12, '0')}`,
        amount_ars: 1500 + i * 10,
        eta_minutes: 10,
        message: null,
        status: (['cancelled', 'rejected', 'expired', 'withdrawn'] as const)[i % 4] ?? 'cancelled',
        created_at: `2026-09-26T14:00:${String(i).padStart(2, '0')}.000Z`,
      }));

      // 55 ofertas pending con timestamps no monótonos respecto al id; índices 2 y 40 empatan en fecha para tie-breaker de id DESC
      const pendingOffers = Array.from({ length: 55 }, (_, i) => ({
        id: `11111111-1111-1111-1111-${String(i + 1).padStart(12, '0')}`,
        request_id: validUuid,
        courier_id: `10000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
        amount_ars: 2000 + i * 10,
        eta_minutes: 15,
        message: null,
        status: 'pending',
        created_at:
          i === 40
            ? '2026-09-26T12:15:00.000Z'
            : i === 2
              ? '2026-09-26T12:15:00.000Z'
              : `2026-09-26T12:${String((i * 17) % 60).padStart(2, '0')}:${String((i * 31) % 60).padStart(2, '0')}.000Z`,
      }));

      const mixedOffers = [...nonPendingOffers, ...pendingOffers];

      interface MockLiveOffersRow {
        id: string;
        request_id: string;
        courier_id: string;
        amount_ars: number;
        eta_minutes: number;
        message: string | null;
        status: string;
        created_at: string;
      }

      interface SortOrderSpec {
        col: string;
        ascending: boolean;
      }

      interface MockLiveOffersBuilder {
        select: () => MockLiveOffersBuilder;
        eq: (col: string, val: unknown) => MockLiveOffersBuilder;
        order: (col?: string, opts?: { ascending?: boolean }) => MockLiveOffersBuilder;
        or: (filterStr: string) => MockLiveOffersBuilder;
        limit: (count: number) => MockLiveOffersBuilder;
        then: (
          resolve: (value: { data: MockLiveOffersRow[]; error: null }) => unknown
        ) => Promise<unknown>;
      }

      function createFilteringOffersBuilder(): MockLiveOffersBuilder {
        let rows = [...mixedOffers];
        const orderSpecs: SortOrderSpec[] = [];
        const orFilters: string[] = [];
        let limitCount = 51;

        const b: MockLiveOffersBuilder = {
          select: vi.fn(() => b),
          eq: vi.fn((col: string, val: unknown) => {
            rows = rows.filter(
              (r) =>
                (r as Record<string, unknown>)[col === 'request_id' ? 'request_id' : col] ===
                (col === 'request_id' ? validUuid : val)
            );
            return b;
          }),
          order: vi.fn((col?: string, opts?: { ascending?: boolean }) => {
            orderSpecs.push({
              col: col ?? 'id',
              ascending: opts?.ascending ?? true,
            });
            return b;
          }),
          or: vi.fn((filterStr: string) => {
            orFilters.push(filterStr);
            return b;
          }),
          limit: vi.fn((count: number) => {
            limitCount = count;
            return b;
          }),
          then: (resolve) => {
            for (const orExpr of orFilters) {
              const match = orExpr.match(
                /^created_at\.lt\.([^,]+),and\(created_at\.eq\.[^,]+,id\.lt\.([^)]+)\)$/
              );
              if (match && match[1] && match[2]) {
                const cursorCreatedAt = match[1];
                const cursorId = match[2];
                rows = rows.filter(
                  (r) =>
                    r.created_at < cursorCreatedAt ||
                    (r.created_at === cursorCreatedAt && r.id < cursorId)
                );
              }
            }

            const sorted = [...rows].sort((a, bRow) => {
              for (const { col, ascending } of orderSpecs) {
                const valA = a[col as keyof MockLiveOffersRow];
                const valB = bRow[col as keyof MockLiveOffersRow];
                if (valA !== valB) {
                  if (typeof valA === 'string' && typeof valB === 'string') {
                    return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
                  }
                  if (typeof valA === 'number' && typeof valB === 'number') {
                    return ascending ? valA - valB : valB - valA;
                  }
                }
              }
              return 0;
            });

            return Promise.resolve({
              data: sorted.slice(0, limitCount),
              error: null,
            }).then(resolve);
          },
        };
        return b;
      }

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return reqBuilder;
        if (table === 'offers') return createFilteringOffersBuilder();
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: mockFrom,
        rpc: makeCouriersRpc(
          validUuid,
          Array.from({ length: 55 }, (_, i) => i + 1)
        ),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const sortedExpectedPending = [...pendingOffers].sort((a, b) => {
        if (a.created_at !== b.created_at) {
          return b.created_at.localeCompare(a.created_at);
        }
        return b.id.localeCompare(a.id);
      });

      // Página 1: primeras 50 ofertas pending en orden DESC compuesto
      const result1 = await getRequestOffersLiveServer(validUuid);
      expect(result1.ok).toBe(true);
      if (!result1.ok) throw new Error('Query live de ofertas falló en página 1');

      expect(result1.data.data).toHaveLength(50);
      expect(result1.data.data.every((o) => o.status === 'pending')).toBe(true);
      expect(result1.data.data.map((o) => o.id)).toEqual(
        sortedExpectedPending.slice(0, 50).map((o) => o.id)
      );

      // Tie-breaker de id DESC sobre ofertas con misma fecha (índices 40 y 2 comparten timestamp)
      const tieBreakerOfferHigh = result1.data.data.find((o) => o.id === pendingOffers[40]!.id);
      const tieBreakerOfferLow = result1.data.data.find((o) => o.id === pendingOffers[2]!.id);
      expect(tieBreakerOfferHigh).toBeDefined();
      expect(tieBreakerOfferLow).toBeDefined();
      const idxHigh = result1.data.data.indexOf(tieBreakerOfferHigh!);
      const idxLow = result1.data.data.indexOf(tieBreakerOfferLow!);
      expect(idxHigh).toBeLessThan(idxLow!);

      const expected50thPending = sortedExpectedPending[49]!;
      expect(result1.data.nextCursor).toEqual({
        createdAt: expected50thPending.created_at,
        id: expected50thPending.id,
      });

      // Página 2: paginación con cursor que consume las 5 ofertas pending restantes
      const result2 = await getRequestOffersLiveServer(validUuid, result1.data.nextCursor);
      expect(result2.ok).toBe(true);
      if (!result2.ok) throw new Error('Query live de ofertas falló en página 2');

      expect(result2.data.data).toHaveLength(5);
      expect(result2.data.data.every((o) => o.status === 'pending')).toBe(true);
      expect(result2.data.data.map((o) => o.id)).toEqual(
        sortedExpectedPending.slice(50, 55).map((o) => o.id)
      );
      expect(result2.data.nextCursor).toBeNull();
    });
  });

  describe('3.2 getRequestOffersLiveServer — proyección de repartidores (CC-016)', () => {
    it('no embebe couriers/profiles en la consulta de ofertas del comercio', () => {
      const sourceCode = readFileSync('src/server/live/t204.ts', 'utf8');
      expect(sourceCode).not.toMatch(/couriers!courier_id|profiles!profile_id/);
      expect(sourceCode).toContain('getRequestOfferCouriersRpc');
    });

    it('sin ofertas no llama a la RPC y responde lista vacía', async () => {
      const couriersRpc = vi.fn();
      mockMerchantClient([], couriersRpc);

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result).toEqual({ ok: true, data: { data: [], nextCursor: null } });
      expect(couriersRpc).not.toHaveBeenCalled();
    });

    it('si la RPC falla responde 500 en lugar de inventar «Repartidor» y docLevel 0', async () => {
      const couriersRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'NOT_FOUND' },
      });
      mockMerchantClient([makeOfferRow(1, validUuid)], couriersRpc);

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result).toEqual({ ok: false, error: 'DATABASE_ERROR', status: 500 });
    });

    it('si una oferta no tiene su repartidor en la proyección responde 500', async () => {
      mockMerchantClient(
        [makeOfferRow(1, validUuid), makeOfferRow(2, validUuid)],
        makeCouriersRpc(validUuid, [1])
      );

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result).toEqual({ ok: false, error: 'DATABASE_ERROR', status: 500 });
    });

    it('si la RPC devuelve un campo fuera del contrato (teléfono) responde 500', async () => {
      const couriersRpc = vi.fn().mockResolvedValue({
        data: {
          requestId: validUuid,
          couriers: [{ ...makeCourierProjection(1), phone: '3865000001' }],
        },
        error: null,
      });
      mockMerchantClient([makeOfferRow(1, validUuid)], couriersRpc);

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result).toEqual({ ok: false, error: 'DATABASE_ERROR', status: 500 });
    });

    it('conserva los niveles reales para ordenar: doc 2 con $2000 y doc 0 con $1500', async () => {
      const couriersRpc = vi.fn().mockResolvedValue({
        data: {
          requestId: validUuid,
          couriers: [
            {
              ...makeCourierProjection(1),
              licenseStatus: 'verified',
              insuranceStatus: 'verified',
              docLevel: 2,
            },
            { ...makeCourierProjection(2), licenseStatus: 'none', docLevel: 0 },
          ],
        },
        error: null,
      });
      mockMerchantClient(
        [
          { ...makeOfferRow(1, validUuid), amount_ars: 2000 },
          { ...makeOfferRow(2, validUuid), amount_ars: 1500 },
        ],
        couriersRpc
      );

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data.map((o) => [o.courierName, o.docLevel, o.amountArs])).toEqual([
          ['Repartidor 1', 2, 2000],
          ['Repartidor 2', 0, 1500],
        ]);
      }
    });
  });

  describe('3.3 getTripLiveStateServer', () => {
    it('control estático: usa getTripDetailsRpc y no getTripDetailsServer', () => {
      const sourceCode = readFileSync(resolve(__dirname, 't204.ts'), 'utf-8');
      expect(sourceCode).toContain('getTripDetailsRpc');
      expect(sourceCode).not.toContain('getTripDetailsServer');
    });

    it('pasa la instancia de createClient a getTripDetailsRpc', async () => {
      const mockSupabase = { auth: { getUser: vi.fn() } };
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );
      vi.mocked(tripsRpc.getTripDetailsRpc).mockResolvedValue(
        ok({
          requestId: validUuid,
          status: 'matched',
        } as unknown as tripsRpc.TripDetailsServerOutput)
      );

      await getTripLiveStateServer(validUuid);
      expect(tripsRpc.getTripDetailsRpc).toHaveBeenCalledWith(mockSupabase, {
        requestId: validUuid,
      });
    });

    it('retorna 400 si tripId no es UUID', async () => {
      const result = await getTripLiveStateServer('invalid');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
      }
    });

    it('retorna 401 si getTripDetailsRpc devuelve UNAUTHENTICATED', async () => {
      vi.mocked(tripsRpc.getTripDetailsRpc).mockResolvedValue(err('UNAUTHENTICATED'));

      const result = await getTripLiveStateServer(validUuid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.error).toBe('UNAUTHENTICATED');
      }
    });

    it('retorna data: null si getTripDetailsRpc devuelve NOT_FOUND', async () => {
      vi.mocked(tripsRpc.getTripDetailsRpc).mockResolvedValue(err('NOT_FOUND'));

      const result = await getTripLiveStateServer(validUuid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeNull();
      }
    });

    it('retorna 403 si getTripDetailsRpc devuelve UNAUTHORIZED_ACTOR', async () => {
      vi.mocked(tripsRpc.getTripDetailsRpc).mockResolvedValue(err('UNAUTHORIZED_ACTOR'));

      const result = await getTripLiveStateServer(validUuid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(403);
      }
    });

    it('retorna 409 si getTripDetailsRpc devuelve INVALID_STATE_TRANSITION', async () => {
      vi.mocked(tripsRpc.getTripDetailsRpc).mockResolvedValue(err('INVALID_STATE_TRANSITION'));

      const result = await getTripLiveStateServer(validUuid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(409);
      }
    });

    it('happy path: retorna solo id y status, descartando contactos y avatar', async () => {
      vi.mocked(tripsRpc.getTripDetailsRpc).mockResolvedValue(
        ok({
          requestId: validUuid,
          courierId: 'courier-uuid',
          courierName: 'Carlos',
          courierPhone: '3865123456',
          vehicleType: 'motorcycle',
          status: 'in_transit',
          agreedAmountArs: 2000,
          matchedAt: '2026-09-26T12:00:00Z',
          pickupAddress: 'San Martín 123',
          dropoffAddress: 'Belgrano 456',
          recipientName: 'Juan Pérez',
          recipientPhone: '3865999999',
          pickupLat: -27.43,
          pickupLng: -65.58,
          dropoffLat: -27.44,
          dropoffLng: -65.59,
          pickupZoneName: 'Centro',
          dropoffZoneName: 'Aguilares',
          approxDistanceKm: '1,5',
        } as unknown as tripsRpc.TripDetailsServerOutput)
      );

      const result = await getTripLiveStateServer(validUuid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          id: validUuid,
          status: 'in_transit',
        });
        // Confirmar que no hay campos PII ni extras
        expect(result.data).not.toHaveProperty('avatarUrl');
        expect(result.data).not.toHaveProperty('pickupAddress');
        expect(result.data).not.toHaveProperty('recipientPhone');
      }
    });
  });

  describe('3.4 Índices de paginación keyset (H28 / D04 / Mutación F)', () => {
    it('la migración define exactamente los índices de cursor para delivery_requests y offers', () => {
      const migrationPath = resolve(
        process.cwd(),
        'supabase/migrations/20260926173000_t204_live_pagination_indexes.sql'
      );
      const sqlContent = readFileSync(migrationPath, 'utf8');
      const normalizedSql = sqlContent.toLowerCase().replace(/\s+/g, ' ').trim();

      expect(normalizedSql).toContain(
        "create index delivery_requests_published_cursor_idx on public.delivery_requests (created_at desc, id desc) where status = 'published';"
      );
      expect(normalizedSql).toContain(
        'create index offers_request_created_cursor_idx on public.offers (request_id, created_at desc, id desc);'
      );
    });
  });
});
