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

  interface MockBuilder {
    _calls: MockCallLog;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (resolve: (val: any) => any, reject?: (reason: any) => any) => Promise<any>;
  }

  function createMockQueryBuilder<T>(resolvedData: T, resolvedError: unknown = null): MockBuilder {
    const calls: MockCallLog = {
      select: [],
      eq: [],
      order: [],
      limit: [],
      or: [],
      in: [],
      maybeSingle: [],
    };

    const builder: any = {
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
      then: (resolve: (val: any) => any, reject?: (reason: any) => any) => {
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
      package_type: 'small',
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
      courier: {
        vehicle_type: 'motorcycle',
        license_status: 'verified',
        insurance_status: 'none',
        doc_level: 1,
        profile: { display_name: `Repartidor ${i}` },
      },
    };
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

    it('A & E: Feed con 51 filas -> 50 resultados + nextCursor de fila 50 y hasMyOffer consulta SOLO 50 ids', async () => {
      const rows51 = Array.from({ length: 51 }, (_, i) => makeRequestRow(i + 1));
      const reqBuilder = createMockQueryBuilder(rows51);
      const offersBuilder = createMockQueryBuilder([]);

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

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toHaveLength(50);
        const row50 = rows51[49]!;
        expect(result.data.nextCursor).toEqual({
          createdAt: row50.created_at,
          id: row50.id,
        });

        // Test E: hasMyOffer consulta SOLO los 50 requestIds devueltos, jamás el #51
        const requestedOfferIds = offersBuilder._calls.in[0]?.[1] as string[];
        expect(requestedOfferIds).toHaveLength(50);
        expect(requestedOfferIds).not.toContain(rows51[50]!.id);
      }
    });

    it('B: Feed segunda página -> spy demuestra order(created_at), order(id), limit(51) y .or(...) exacto', async () => {
      const reqBuilder = createMockQueryBuilder([makeRequestRow(1)]);
      const offersBuilder = createMockQueryBuilder([]);

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

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.data[0]?.courierName).toBe('Repartidor 1');
        expect(result.data.data[0]?.amountArs).toBe(1501);
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
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getRequestOffersLiveServer(validUuid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toHaveLength(50);
        const offer50 = offers51[49]!;
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
});
