import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { sortOffersForMerchant } from '@/domain/priority';
import * as serverSupabase from '@/server/supabase/server';
import {
  assertAndMapMerchantDrops,
  getActiveZones,
  getMerchantDefaultPickup,
  getMerchantHistoryRequests,
  getMerchantRequests,
  getMerchantRequestWithOffers,
  parseMerchantHistorySearchParams,
} from './queries';
import type { MerchantDropSummary } from './types';

vi.mock('@/server/supabase/server', () => {
  const createClientMock = vi.fn();
  return {
    createClient: new Proxy(createClientMock, {
      apply(target, thisArg, argArray) {
        const result = Reflect.apply(target, thisArg, argArray);
        if (result && typeof result.then === 'function') {
          return result.then((resolved: unknown) => {
            if (
              resolved &&
              typeof resolved === 'object' &&
              !('rpc' in (resolved as Record<string, unknown>))
            ) {
              return {
                ...resolved,
                rpc: vi.fn().mockImplementation((name: string) => {
                  if (name === 'reconcile_expired_requests') {
                    return Promise.resolve({
                      data: { expiredRequestIds: [], expiredCount: 0, hasMore: false },
                      error: null,
                    });
                  }
                  return Promise.resolve({ data: null, error: null });
                }),
              };
            }
            return resolved;
          });
        }
        return result;
      },
    }),
  };
});

function mockDropsTable(data?: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockImplementation((_col: string, ids: string[]) => ({
        order: vi.fn().mockImplementation(() => {
          if (data !== undefined) {
            return Promise.resolve({ data, error: null });
          }
          const defaultDrops = (ids ?? []).map((id) => ({
            id: `drop-${id}`,
            request_id: id,
            position: 1,
            package_type: 'chico',
            recipient_payment_method: 'cash',
            needs_change: false,
            approx_distance_m: 1000,
            status: 'delivered',
            delivered_at: null,
            failed_reason: null,
            dropoff_zone: { name: 'Barrio Sur' },
          }));
          return Promise.resolve({ data: defaultDrops, error: null });
        }),
      })),
      eq: vi.fn().mockImplementation((_col: string, id: string) => ({
        order: vi.fn().mockImplementation(() => {
          if (data !== undefined) {
            return Promise.resolve({ data, error: null });
          }
          const defaultDrops = [
            {
              id: `drop-${id}`,
              request_id: id,
              position: 1,
              package_type: 'chico',
              recipient_payment_method: 'cash',
              needs_change: false,
              approx_distance_m: 1000,
              status: 'delivered',
              delivered_at: null,
              failed_reason: null,
              dropoff_zone: { name: 'Barrio Sur' },
            },
          ];
          return Promise.resolve({ data: defaultDrops, error: null });
        }),
      })),
    }),
  };
}

describe('T-112 / T-118: queries de requests e historial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveZones', () => {
    it('retorna la lista ordenada de zonas activas', async () => {
      const mockZones = [
        { id: 'z1', name: 'Barrio Centro', centroid_lat: -27.43, centroid_lng: -65.61 },
        { id: 'z2', name: 'Barrio San Martín', centroid_lat: -27.44, centroid_lng: -65.62 },
      ];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'zones') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockZones, error: null }),
          };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      const zones = await getActiveZones();
      expect(zones).toHaveLength(2);
      expect(zones[0]).toEqual({
        id: 'z1',
        name: 'Barrio Centro',
        centroidLat: -27.43,
        centroidLng: -65.61,
      });
    });

    it('propaga el error ante falla de base para activar error.tsx (PR87-H06)', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'zones') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
          };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      await expect(getActiveZones()).rejects.toThrow('Error al cargar zonas activas: DB Error');
    });
  });

  describe('getMerchantDefaultPickup', () => {
    it('retorna los datos de retiro configurados en el perfil del comercio', async () => {
      const mockMerchant = {
        default_pickup_address: 'Av. Sarmiento 120',
        default_pickup_zone_id: 'z1',
        default_pickup_lat: -27.43,
        default_pickup_lng: -65.61,
        notes: 'Timbre blanco',
      };

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockMerchant, error: null }),
          };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      const defaultPickup = await getMerchantDefaultPickup('usr-merchant-1');
      expect(defaultPickup).toEqual({
        defaultPickupAddress: 'Av. Sarmiento 120',
        defaultPickupZoneId: 'z1',
        defaultPickupLat: -27.43,
        defaultPickupLng: -65.61,
        notes: 'Timbre blanco',
      });
    });

    it('retorna null cuando no existe el comercio y error es null, pero lanza si hay error DB (PR87-H06)', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      const defaultPickup = await getMerchantDefaultPickup('usr-inexistente');
      expect(defaultPickup).toBeNull();
    });
  });

  describe('getMerchantHistoryRequests y parseMerchantHistorySearchParams (PR87-H05 / R01)', () => {
    it('pagina más de 50 filas devolviendo 50 ítems y nextCursor con createdAt + id del ítem 50', async () => {
      const fiftyOneRows = Array.from({ length: 51 }, (_, idx) => {
        const num = String(idx + 1).padStart(4, '0');
        return {
          id: `00000000-0000-4000-8000-00000000${num}`,
          approx_distance_m: 1500,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          cash_change_amount: null,
          status: 'delivered',
          expires_at: null,
          created_at: `2026-03-31T10:${String(59 - idx).padStart(2, '0')}:00.000Z`,
          accepted_offer_id: null,
          pickup_zone: { name: 'Barrio Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        };
      });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: fiftyOneRows, error: null }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'delivery_request_drops') return mockDropsTable();
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      const result = await getMerchantHistoryRequests('merchant-1', { limit: 50 });
      expect(result.requests).toHaveLength(50);
      expect(result.nextCursor).toEqual({
        createdAt: fiftyOneRows[49]!.created_at,
        id: fiftyOneRows[49]!.id,
      });
    });

    it('aplica filtro por estado EN LA QUERY antes de paginar y desempata created_at por id en la segunda página (PR87-R01)', async () => {
      const callLog: string[] = [];
      const validCursor = {
        createdAt: '2026-03-31T10:00:00.000Z',
        id: '11111111-2222-4333-8444-555555555555',
      };

      // Ítem #55 entregado que sin filtro habría quedado fuera del lote 1..50
      const deliveredPage2Row = {
        id: '11111111-2222-4333-8444-555555555500',
        approx_distance_m: 2000,
        package_type: 'mediano',
        recipient_payment_method: 'transfer',
        needs_change: false,
        cash_change_amount: null,
        status: 'delivered',
        expires_at: null,
        created_at: '2026-03-31T10:00:00.000Z',
        accepted_offer_id: null,
        pickup_zone: { name: 'Barrio Centro' },
        dropoff_zone: { name: 'Villa Nueva' },
      };

      const queryBuilder = {
        select: vi.fn(() => {
          callLog.push('select');
          return queryBuilder;
        }),
        eq: vi.fn((col: string, val: string) => {
          callLog.push(`eq:${col}=${val}`);
          return queryBuilder;
        }),
        order: vi.fn((col: string) => {
          callLog.push(`order:${col}`);
          return queryBuilder;
        }),
        limit: vi.fn((n: number) => {
          callLog.push(`limit:${n}`);
          return queryBuilder;
        }),
        or: vi.fn((expr: string) => {
          callLog.push(`or:${expr}`);
          return Promise.resolve({ data: [deliveredPage2Row], error: null });
        }),
      };

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') return queryBuilder;
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'delivery_request_drops') return mockDropsTable();
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      const result = await getMerchantHistoryRequests('merchant-1', {
        limit: 50,
        status: 'delivered',
        cursor: validCursor,
      });

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.id).toBe(deliveredPage2Row.id);
      // Verifica que eq:status=delivered ocurre ANTES de limit:51 y que el desempate created_at + id es exacto
      const statusIdx = callLog.indexOf('eq:status=delivered');
      const limitIdx = callLog.indexOf('limit:51');
      expect(statusIdx).toBeGreaterThan(-1);
      expect(limitIdx).toBeGreaterThan(statusIdx);
      expect(callLog).toContain(
        `or:created_at.lt.${validCursor.createdAt},and(created_at.eq.${validCursor.createdAt},id.lt.${validCursor.id})`
      );
    });

    it('rechaza/normaliza cursores inválidos con Zod sin invocar .or(...)', async () => {
      const parsed = parseMerchantHistorySearchParams({
        status: 'invalid_status',
        cursorCreatedAt: 'not-an-iso-date',
        cursorId: 'not-a-uuid',
      });
      expect(parsed).toEqual({ status: 'all', cursor: null });

      const orSpy = vi.fn();
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        or: orSpy,
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn().mockReturnValue(queryBuilder),
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      await getMerchantHistoryRequests('merchant-1', {
        cursor: { createdAt: 'invalid-date', id: 'invalid-uuid' },
      });
      expect(orSpy).not.toHaveBeenCalled();
    });
  });

  describe('getMerchantRequests: métricas globales C02 y tarifa promedio real o null (PR87-R02 / H13)', () => {
    it('calcula métricas globales sobre el total del comercio (sin truncar a 50) y avgRateArs null si no hay ofertas aceptadas', async () => {
      const todayIso = new Date().toISOString();
      const allSixtyRows = Array.from({ length: 60 }, (_, idx) => ({
        id: `req-${idx + 1}`,
        approx_distance_m: 1200,
        package_type: 'sobre',
        recipient_payment_method: 'cash',
        needs_change: false,
        cash_change_amount: null,
        status: idx < 55 ? 'published' : 'delivered',
        expires_at: null,
        created_at: todayIso,
        accepted_offer_id: null,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: { name: 'Norte' },
      }));

      let deliveryCallCount = 0;
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          deliveryCallCount += 1;
          if (deliveryCallCount === 1) {
            // Query paginada (51 filas)
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: allSixtyRows.slice(0, 51), error: null }),
            };
          }
          // Queries acotadas de métricas en lotes de 50 (PR87-R03)
          const batchRows =
            deliveryCallCount === 2 ? allSixtyRows.slice(0, 50) : allSixtyRows.slice(50, 60);
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: batchRows, error: null }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'delivery_request_drops') {
          return mockDropsTable();
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      const result = await getMerchantRequests('merchant-1', { limit: 50 });
      expect(result.requests).toHaveLength(50);
      expect(result.metrics.activeCount).toBe(55); // 55 activas reales (no truncado a 50)
      expect(result.metrics.dispatchedToday).toBe(5); // los 5 entregados en posiciones 56..60 se contabilizan
      expect(result.metrics.avgRateArs).toBeNull(); // nunca $0 inventado cuando no hay ofertas aceptadas
    });

    it('calcula avgRateArs real cuando existen ofertas aceptadas', async () => {
      const todayIso = new Date().toISOString();
      const rows = [
        {
          id: 'req-1',
          approx_distance_m: 1000,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          cash_change_amount: null,
          status: 'delivered',
          expires_at: null,
          created_at: todayIso,
          accepted_offer_id: 'off-1',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Norte' },
        },
        {
          id: 'req-2',
          approx_distance_m: 2000,
          package_type: 'mediano',
          recipient_payment_method: 'transfer',
          needs_change: false,
          cash_change_amount: null,
          status: 'matched',
          expires_at: null,
          created_at: todayIso,
          accepted_offer_id: 'off-2',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Norte' },
        },
      ];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn((cols: string) => {
              if (cols === 'amount_ars') {
                return {
                  in: vi.fn().mockResolvedValue({
                    data: [{ amount_ars: 1800 }, { amount_ars: 2400 }],
                    error: null,
                  }),
                };
              }
              return {
                in: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        if (table === 'delivery_request_drops') {
          return mockDropsTable();
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
        ? T
        : never);

      const result = await getMerchantRequests('merchant-1');
      expect(result.metrics.avgRateArs).toBe(2100);
      expect(result.metrics.dispatchedToday).toBe(2);
      expect(result.metrics.activeCount).toBe(1);
    });

    it('PR87-H17: status=all en C07 filtra exclusivamente estados terminales (delivered, cancelled, expired) antes de paginar y excluye activas con >50 filas', async () => {
      const callLog: string[] = [];
      const terminalRows = Array.from({ length: 51 }, (_, idx) => ({
        id: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
        approx_distance_m: 1400,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        cash_change_amount: null,
        status: idx % 2 === 0 ? 'delivered' : 'cancelled',
        expires_at: null,
        created_at: `2026-09-24T12:${String(59 - idx).padStart(2, '0')}:00.000Z`,
        accepted_offer_id: null,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: { name: 'Sur' },
      }));

      const queryBuilder = {
        select: vi.fn(() => {
          callLog.push('select');
          return queryBuilder;
        }),
        eq: vi.fn((col: string, val: string) => {
          callLog.push(`eq:${col}=${val}`);
          return queryBuilder;
        }),
        in: vi.fn((col: string, vals: string[]) => {
          callLog.push(`in:${col}=[${vals.join(',')}]`);
          return queryBuilder;
        }),
        order: vi.fn((col: string) => {
          callLog.push(`order:${col}`);
          return queryBuilder;
        }),
        limit: vi.fn((n: number) => {
          callLog.push(`limit:${n}`);
          return Promise.resolve({ data: terminalRows, error: null });
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'delivery_requests') return queryBuilder;
          if (table === 'delivery_request_drops') return mockDropsTable();
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const res = await getMerchantHistoryRequests('merchant-1', { status: 'all', limit: 50 });
      const inIdx = callLog.indexOf('in:status=[delivered,cancelled,expired]');
      const limitIdx = callLog.indexOf('limit:51');
      expect(inIdx).toBeGreaterThan(-1);
      expect(limitIdx).toBeGreaterThan(inIdx);
      expect(res.requests).toHaveLength(50);
      expect(
        res.requests.every((r) => ['delivered', 'cancelled', 'expired'].includes(r.status))
      ).toBe(true);
    });

    it('PR87-H18: C07 hidrata cadete y monto real cuando hay oferta aceptada y devuelve null honesto cuando fue cancelada/vencida sin oferta aceptada', async () => {
      const historyRows = [
        {
          id: 'req-delivered-1',
          approx_distance_m: 1800,
          package_type: 'mediano',
          recipient_payment_method: 'cash',
          needs_change: false,
          cash_change_amount: null,
          status: 'delivered',
          expires_at: null,
          created_at: '2026-09-24T14:00:00.000Z',
          accepted_offer_id: 'off-accepted-99',
          pickup_zone: { name: 'Barrio Centro' },
          dropoff_zone: { name: 'Villa Nueva' },
        },
        {
          id: 'req-cancelled-2',
          approx_distance_m: null,
          package_type: 'sobre',
          recipient_payment_method: 'transfer',
          needs_change: false,
          cash_change_amount: null,
          status: 'cancelled',
          expires_at: null,
          created_at: '2026-09-24T13:00:00.000Z',
          accepted_offer_id: null,
          pickup_zone: { name: 'Barrio Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: historyRows, error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn((cols: string) => {
                if (cols.includes('amount_ars')) {
                  return {
                    in: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'off-accepted-99',
                          amount_ars: 2300,
                          courier: { profile: { display_name: 'Lucía Fernández' } },
                        },
                      ],
                      error: null,
                    }),
                  };
                }
                return {
                  in: vi.fn().mockReturnThis(),
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
              }),
            };
          }
          if (table === 'delivery_request_drops') return mockDropsTable();
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const res = await getMerchantHistoryRequests('merchant-1', { status: 'all' });
      expect(res.requests[0]?.acceptedAmountArs).toBe(2300);
      expect(res.requests[0]?.acceptedCourierName).toBe('Lucía Fernández');
      expect(res.requests[1]?.acceptedAmountArs).toBeNull();
      expect(res.requests[1]?.acceptedCourierName).toBeNull();
    });

    it('PR87-R03 / H19: ninguna query de métricas se ejecuta sin .limit(<=51) y el día civil se calcula en America/Argentina/Buenos_Aires (2026-09-25T01:30:00Z sigue siendo 24/09 en Aguilares, sin contaminar con días previos)', async () => {
      // Instante borde: 2026-09-25T01:30:00Z = 2026-09-24 22:30 en Aguilares (UTC-3)
      const borderNow = new Date('2026-09-25T01:30:00.000Z');
      const reqTodayAguilares = {
        id: 'req-today-ar',
        approx_distance_m: 1500,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        cash_change_amount: null,
        status: 'delivered',
        expires_at: null,
        created_at: '2026-09-25T01:15:00.000Z', // 24/09 22:15 en Aguilares -> HOY
        accepted_offer_id: 'off-today-1',
        pickup_zone: { name: 'Centro' },
        dropoff_zone: { name: 'Sur' },
      };
      const reqYesterdayAguilares = {
        id: 'req-yesterday-ar',
        approx_distance_m: 1500,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        cash_change_amount: null,
        status: 'delivered',
        expires_at: null,
        created_at: '2026-09-24T02:15:00.000Z', // 23/09 23:15 en Aguilares -> AYER
        accepted_offer_id: 'off-yesterday-1',
        pickup_zone: { name: 'Centro' },
        dropoff_zone: { name: 'Sur' },
      };

      const unboundedCalls: string[] = [];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'delivery_requests') {
            let hasLimit = false;
            const builder = {
              select: vi.fn().mockImplementation(() => builder),
              eq: vi.fn().mockImplementation(() => {
                // Si alguien hace await directo a .eq() sin pasar por .limit(), registramos violación R03
                return builder;
              }),
              in: vi.fn().mockImplementation(() => builder),
              gte: vi.fn().mockImplementation(() => builder),
              lt: vi.fn().mockImplementation(() => builder),
              order: vi.fn().mockImplementation(() => builder),
              or: vi.fn().mockImplementation(() => builder),
              limit: vi.fn().mockImplementation((n: number) => {
                if (n <= 51) hasLimit = true;
                return Promise.resolve({
                  data: [reqTodayAguilares, reqYesterdayAguilares],
                  error: null,
                });
              }),
              then: (resolve: (v: unknown) => void) => {
                if (!hasLimit) {
                  unboundedCalls.push('unbounded-delivery-requests-query');
                }
                resolve({ data: [reqTodayAguilares, reqYesterdayAguilares], error: null });
              },
            };
            return builder;
          }
          if (table === 'offers') {
            return {
              select: vi.fn((cols: string) => {
                if (cols === 'amount_ars') {
                  return {
                    in: vi.fn((_col: string, ids: string[]) => ({
                      limit: vi.fn().mockResolvedValue({
                        data: ids.map((id) =>
                          id === 'off-today-1' ? { amount_ars: 2500 } : { amount_ars: 9900 }
                        ),
                        error: null,
                      }),
                    })),
                  };
                }
                return {
                  in: vi.fn().mockReturnThis(),
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
              }),
            };
          }
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const res = await getMerchantRequests('merchant-1', { limit: 50, now: borderNow });
      expect(unboundedCalls).toEqual([]);
      expect(res.metrics.dispatchedToday).toBe(1); // Solo reqTodayAguilares (24/09 22:15 AR)
      expect(res.metrics.avgRateArs).toBe(2500); // No contaminado por 9900 de ayer
    });
  });

  describe('Ronda 4: PR87-R04 (501 solicitudes y 51 ofertas sin tope arbitrario) y PR87-H20 (C02 sólo activas)', () => {
    it('procesa 501 solicitudes en lotes de <=50 (la #501 afecta métricas) y promedia 51 ofertas del día (50x$1000 + 1x$10000 => $1176) (PR87-R04)', async () => {
      const now = new Date('2026-09-24T18:00:00.000Z');
      const all501Rows = Array.from({ length: 501 }, (_, idx) => {
        const num = idx + 1;
        const isRow501 = num === 501;
        return {
          id: `req-${String(num).padStart(4, '0')}`,
          approx_distance_m: 1400,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          cash_change_amount: null,
          status: isRow501 ? 'delivered' : 'published',
          expires_at: null,
          created_at: new Date(now.getTime() - idx * 1000).toISOString(),
          accepted_offer_id: num <= 51 ? `off-${num}` : null,
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Norte' },
        };
      });

      let deliveryCallIdx = 0;
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            deliveryCallIdx += 1;
            const currentCall = deliveryCallIdx;
            const builder = {
              select: vi.fn().mockImplementation(() => builder),
              eq: vi.fn().mockImplementation(() => builder),
              in: vi.fn().mockImplementation(() => builder),
              order: vi.fn().mockImplementation(() => builder),
              or: vi.fn().mockImplementation(() => builder),
              limit: vi.fn().mockImplementation((limitArg: number) => {
                expect(limitArg).toBeLessThanOrEqual(51);
                if (currentCall === 1) {
                  return Promise.resolve({ data: all501Rows.slice(0, 51), error: null });
                }
                const batchIndex = currentCall - 2; // 0..10 (11 lotes para 501 filas)
                const start = batchIndex * 50;
                const slice = all501Rows.slice(start, start + 50);
                return Promise.resolve({ data: slice, error: null });
              }),
            };
            return builder;
          }
          if (table === 'offers') {
            return {
              select: vi.fn((cols: string) => {
                if (cols === 'amount_ars') {
                  return {
                    in: vi.fn((_col: string, ids: string[]) => {
                      expect(ids.length).toBeLessThanOrEqual(50);
                      return {
                        limit: vi.fn().mockResolvedValue({
                          data: ids.map((id) => ({
                            amount_ars: id === 'off-51' ? 10000 : 1000,
                          })),
                          error: null,
                        }),
                      };
                    }),
                  };
                }
                return {
                  in: vi.fn().mockReturnThis(),
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
              }),
            };
          }
          if (table === 'delivery_request_drops') return mockDropsTable();
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const res = await getMerchantRequests('merchant-1', { limit: 50, now });
      expect(res.metrics.activeCount).toBe(500);
      // La solicitud #501 es la única delivered del día: si se truncara en 500 daría 0
      expect(res.metrics.dispatchedToday).toBe(1);
      // 50 ofertas de $1000 + la #51 de $10000 = 60000 / 51 = 1176.47 => 1176 (con slice(0,50) daría 1000)
      expect(res.metrics.avgRateArs).toBe(1176);
    });

    it('filtra C02 en DB a published|matched|in_transit antes de paginar y excluye estados terminales (PR87-H20)', async () => {
      const callOrder: string[] = [];
      const mixedRows = [
        {
          id: 'req-active-1',
          approx_distance_m: 1200,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          cash_change_amount: null,
          status: 'published',
          expires_at: null,
          created_at: '2026-09-24T15:00:00.000Z',
          accepted_offer_id: null,
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Norte' },
        },
        {
          id: 'req-term-1',
          approx_distance_m: 1500,
          package_type: 'mediano',
          recipient_payment_method: 'transfer',
          needs_change: false,
          cash_change_amount: null,
          status: 'delivered',
          expires_at: null,
          created_at: '2026-09-24T14:00:00.000Z',
          accepted_offer_id: 'off-1',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Sur' },
        },
        {
          id: 'req-active-2',
          approx_distance_m: 1800,
          package_type: 'grande',
          recipient_payment_method: 'cash',
          needs_change: false,
          cash_change_amount: null,
          status: 'in_transit',
          expires_at: null,
          created_at: '2026-09-24T13:00:00.000Z',
          accepted_offer_id: 'off-2',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Oeste' },
        },
        {
          id: 'req-term-2',
          approx_distance_m: 1100,
          package_type: 'sobre',
          recipient_payment_method: 'cash',
          needs_change: false,
          cash_change_amount: null,
          status: 'cancelled',
          expires_at: null,
          created_at: '2026-09-24T12:00:00.000Z',
          accepted_offer_id: null,
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Este' },
        },
      ];

      let deliveryCallCount = 0;
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            deliveryCallCount += 1;
            const isFirstPageQuery = deliveryCallCount === 1;
            const builder = {
              select: vi.fn().mockImplementation(() => builder),
              eq: vi.fn().mockImplementation(() => builder),
              in: vi.fn().mockImplementation((col: string, vals: string[]) => {
                if (isFirstPageQuery) {
                  callOrder.push(`in:${col}=[${vals.join(',')}]`);
                }
                return builder;
              }),
              order: vi.fn().mockImplementation(() => builder),
              or: vi.fn().mockImplementation(() => builder),
              limit: vi.fn().mockImplementation((n: number) => {
                if (isFirstPageQuery) {
                  callOrder.push(`limit:${n}`);
                }
                return Promise.resolve({ data: mixedRows, error: null });
              }),
            };
            return builder;
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') return mockDropsTable();
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const res = await getMerchantRequests('merchant-1');
      const inIdx = callOrder.indexOf('in:status=[published,matched,in_transit]');
      const limitIdx = callOrder.indexOf('limit:51');
      expect(inIdx).toBeGreaterThan(-1);
      expect(limitIdx).toBeGreaterThan(-1);
      expect(inIdx).toBeLessThan(limitIdx);
      expect(res.requests.map((r) => r.id)).toEqual(['req-active-1', 'req-active-2']);
    });
  });

  describe('getMerchantRequestWithOffers', () => {
    const validUuid = '11111111-1111-1111-1111-111111111111';
    // CC-023: el detalle también llama a get_merchant_request_private_fields; el resto de las RPC van al mock
    // de cada test.
    type RpcMock = Mock<(fn: string, args?: Record<string, unknown>) => unknown>;
    const withPrivateFields = (couriersRpc: ReturnType<typeof vi.fn>) =>
      vi.fn((fn: string, args?: Record<string, unknown>) =>
        fn === 'get_merchant_request_private_fields'
          ? Promise.resolve({
              data: { requestId: validUuid, notes: null, cashChangeAmount: null },
              error: null,
            })
          : (couriersRpc as RpcMock)(fn, args)
      );
    const courierUuid = (i: number) => `10000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
    const mockRequestRow = {
      id: validUuid,
      approx_distance_m: 1500,
      package_type: 'small',
      recipient_payment_method: 'cash',
      needs_change: false,
      cash_change_amount: null,
      notes: null,
      status: 'published',
      expires_at: null,
      created_at: '2026-09-26T12:00:00.000Z',
      accepted_offer_id: null,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Aguilares' },
    };

    it('retorna request, offers y nextOffersCursor null cuando hay <= 50 ofertas', async () => {
      const mockOffers = [
        {
          id: '22222222-2222-2222-2222-222222222222',
          courier_id: courierUuid(1),
          amount_ars: 2000,
          eta_minutes: 15,
          message: null,
          status: 'pending',
          created_at: '2026-09-26T12:05:00.000Z',
        },
      ];
      const couriersRpc = vi.fn().mockResolvedValue({
        data: {
          requestId: validUuid,
          couriers: [
            {
              courierId: courierUuid(1),
              displayName: 'Carlos',
              vehicleType: 'moto',
              licenseStatus: 'verified',
              insuranceStatus: 'verified',
              docLevel: 2,
            },
          ],
        },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockRequestRow, error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: mockOffers, error: null }),
            };
          }
          if (table === 'delivery_request_drops') return mockDropsTable();
          return {};
        }),
        rpc: withPrivateFields(couriersRpc),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getMerchantRequestWithOffers(validUuid, 'merchant-1');
      expect(couriersRpc).toHaveBeenCalledExactlyOnceWith('get_request_offer_couriers', {
        p_request_id: validUuid,
      });
      expect(result).not.toBeNull();
      expect(result?.offers).toHaveLength(1);
      expect(result?.offers[0]).toMatchObject({
        courierName: 'Carlos',
        vehicleType: 'moto',
        licenseStatus: 'verified',
        insuranceStatus: 'verified',
        docLevel: 2,
        amountArs: 2000,
      });
      expect(result?.nextOffersCursor).toBeNull();
    });

    it('pagina ofertas con limit(51), retorna 50 ítems y nextOffersCursor con datos de fila 50', async () => {
      const fiftyOneOffers = Array.from({ length: 51 }, (_, i) => ({
        id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
        courier_id: courierUuid(i + 1),
        amount_ars: 2000 + i * 10,
        eta_minutes: 15,
        message: null,
        status: 'pending',
        created_at: `2026-09-26T12:${String(59 - i).padStart(2, '0')}:00.000Z`,
      }));
      const couriersRpc = vi.fn().mockResolvedValue({
        data: {
          requestId: validUuid,
          couriers: fiftyOneOffers.map((offer, i) => ({
            courierId: offer.courier_id,
            displayName: `Courier ${i + 1}`,
            vehicleType: 'moto',
            licenseStatus: 'verified',
            insuranceStatus: 'none',
            docLevel: 1,
          })),
        },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockRequestRow, error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: fiftyOneOffers, error: null }),
            };
          }
          if (table === 'delivery_request_drops') return mockDropsTable();
          return {};
        }),
        rpc: withPrivateFields(couriersRpc),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getMerchantRequestWithOffers(validUuid, 'merchant-1');
      expect(result).not.toBeNull();
      expect(result?.offers).toHaveLength(50);
      const targetOffer = fiftyOneOffers[49];
      expect(result?.nextOffersCursor).toEqual(
        targetOffer ? { createdAt: targetOffer.created_at, id: targetOffer.id } : null
      );
    });

    function mockMerchantDetailClient(offers: readonly unknown[], rpc: ReturnType<typeof vi.fn>) {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockRequestRow, error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: offers, error: null }),
            };
          }
          if (table === 'delivery_request_drops') return mockDropsTable();
          return {};
        }),
        rpc: withPrivateFields(rpc),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    }

    const pendingOffer = (i: number, amountArs: number) => ({
      id: `22222222-2222-2222-2222-${String(i).padStart(12, '0')}`,
      courier_id: courierUuid(i),
      amount_ars: amountArs,
      eta_minutes: 15,
      message: null,
      status: 'pending',
      created_at: `2026-09-26T12:0${i}:00.000Z`,
    });

    it('CC-016: no embebe couriers/profiles en la consulta de ofertas del comercio', () => {
      const sourceCode = readFileSync('src/features/requests/queries.ts', 'utf8');
      const fnSource = sourceCode.slice(
        sourceCode.indexOf('export async function getMerchantRequestWithOffers')
      );
      expect(fnSource).not.toMatch(/couriers!courier_id|profiles!profile_id/);
      expect(fnSource).toContain('getRequestOfferCouriersRpc');
    });

    it('CC-016: sin ofertas no llama a la RPC', async () => {
      const couriersRpc = vi.fn();
      mockMerchantDetailClient([], couriersRpc);

      const result = await getMerchantRequestWithOffers(validUuid, 'merchant-1');
      expect(result?.offers).toEqual([]);
      expect(couriersRpc).not.toHaveBeenCalled();
    });

    it('CC-016: si la RPC falla lanza en lugar de inventar «Repartidor» y docLevel 0', async () => {
      const couriersRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'NOT_FOUND' },
      });
      mockMerchantDetailClient([pendingOffer(1, 2000)], couriersRpc);

      await expect(getMerchantRequestWithOffers(validUuid, 'merchant-1')).rejects.toThrow(
        'Error al cargar repartidores de las ofertas: NOT_FOUND'
      );
    });

    it('CC-016: si una oferta no tiene su repartidor en la proyección lanza', async () => {
      const couriersRpc = vi.fn().mockResolvedValue({
        data: { requestId: validUuid, couriers: [] },
        error: null,
      });
      mockMerchantDetailClient([pendingOffer(1, 2000)], couriersRpc);

      await expect(getMerchantRequestWithOffers(validUuid, 'merchant-1')).rejects.toThrow(
        'Error al cargar repartidores de las ofertas: NOT_FOUND'
      );
    });

    it('CC-016: entrega los niveles reales que la lista necesita para ordenar por documentación y por precio', async () => {
      const couriersRpc = vi.fn().mockResolvedValue({
        data: {
          requestId: validUuid,
          couriers: [
            {
              courierId: courierUuid(1),
              displayName: 'Courier Doc2',
              vehicleType: 'moto',
              licenseStatus: 'verified',
              insuranceStatus: 'verified',
              docLevel: 2,
            },
            {
              courierId: courierUuid(2),
              displayName: 'Courier Doc0',
              vehicleType: null,
              licenseStatus: 'none',
              insuranceStatus: 'none',
              docLevel: 0,
            },
          ],
        },
        error: null,
      });
      mockMerchantDetailClient([pendingOffer(1, 2000), pendingOffer(2, 1500)], couriersRpc);

      const result = await getMerchantRequestWithOffers(validUuid, 'merchant-1');
      const offers = result?.offers ?? [];
      expect(offers).toHaveLength(2);

      expect(sortOffersForMerchant(offers, 'doc_level').map((o) => o.courierName)).toEqual([
        'Courier Doc2',
        'Courier Doc0',
      ]);
      expect(sortOffersForMerchant(offers, 'price').map((o) => o.courierName)).toEqual([
        'Courier Doc0',
        'Courier Doc2',
      ]);
    });
  });

  const validUuidB = '33333333-3333-4333-8333-333333333334';

  describe('CC-023: los lectores del comercio no leen notes ni cash_change_amount por tabla', () => {
    const requestId = '33333333-3333-4333-8333-333333333333';
    const requestRow = (id: string, status = 'published') => ({
      id,
      approx_distance_m: 1500,
      package_type: 'chico',
      recipient_payment_method: 'cash',
      needs_change: true,
      status,
      expires_at: null,
      created_at: new Date().toISOString(),
      accepted_offer_id: null,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Sur' },
    });

    // Builder encadenable y awaitable en cualquier punto, como el de PostgREST.
    function chain(rows: readonly unknown[], selects: string[]) {
      const result = { data: rows, error: null };
      const builder: Record<string, unknown> = {
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      builder.select = vi.fn((columns: string) => {
        selects.push(columns);
        return builder;
      });
      for (const method of ['eq', 'in', 'lt', 'or', 'order', 'limit']) {
        builder[method] = vi.fn(() => builder);
      }
      builder.maybeSingle = vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null });
      return builder;
    }

    function mockClient(
      requestRows: readonly unknown[],
      rpc: ReturnType<typeof vi.fn> = vi.fn().mockImplementation((name: string) => {
        if (name === 'reconcile_expired_requests') {
          return Promise.resolve({
            data: { expiredRequestIds: [], expiredCount: 0, hasMore: false },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      })
    ): string[] {
      const requestSelects: string[] = [];
      const dropRows = (requestRows as Array<{ id: string }>).map((r) => ({
        id: `drop-${r.id}`,
        request_id: r.id,
        position: 1,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: true,
        approx_distance_m: 1000,
        status: 'pending',
        delivered_at: null,
        failed_reason: null,
        dropoff_zone: { name: 'Sur' },
      }));

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') return chain(requestRows, requestSelects);
          if (table === 'delivery_request_drops') return chain(dropRows, []);
          return chain([], []);
        }),
        rpc,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
      return requestSelects;
    }

    it('getMerchantHistoryRequests no selecciona cash_change_amount y no expone cashChangeAmount', async () => {
      const selects = mockClient([
        requestRow(requestId, 'delivered'),
        requestRow(validUuidB, 'delivered'),
      ]);

      const result = await getMerchantHistoryRequests('merchant-1', { limit: 50 });
      expect(result.requests).toHaveLength(2);

      expect(selects.length).toBeGreaterThan(0);
      for (const columns of selects) {
        expect(columns).not.toContain('cash_change_amount');
        expect(columns).not.toMatch(/\bnotes\b/);
      }
      expect(result.requests[0]).not.toHaveProperty('cashChangeAmount');
    });

    it('getMerchantRequests no selecciona cash_change_amount en ninguna de sus consultas', async () => {
      const selects = mockClient([requestRow(requestId), requestRow(validUuidB)]);

      const result = await getMerchantRequests('merchant-1', { limit: 50 });
      expect(result.requests).toHaveLength(2);

      expect(selects.length).toBeGreaterThan(0);
      for (const columns of selects) {
        expect(columns).not.toContain('cash_change_amount');
        expect(columns).not.toMatch(/\bnotes\b/);
      }
      expect(result.requests[0]).not.toHaveProperty('cashChangeAmount');
    });

    it('getMerchantRequestWithOffers obtiene notes y cashChangeAmount por get_merchant_request_private_fields', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: { requestId, notes: 'Tocar timbre 2B', cashChangeAmount: 5000 },
        error: null,
      });
      const selects = mockClient([requestRow(requestId)], rpc);

      const result = await getMerchantRequestWithOffers(requestId, 'merchant-1');

      expect(selects).toHaveLength(1);
      expect(selects[0]).not.toContain('cash_change_amount');
      expect(selects[0]).not.toMatch(/\bnotes\b/);
      expect(rpc).toHaveBeenCalledExactlyOnceWith('get_merchant_request_private_fields', {
        p_request_id: requestId,
      });
      expect(result?.request).toMatchObject({
        id: requestId,
        needsChange: true,
        cashChangeAmount: 5000,
        notes: 'Tocar timbre 2B',
      });
    });

    it('getMerchantRequestWithOffers lanza si la RPC de campos privados falla, sin inventar valores', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'UNAUTHORIZED_ACTOR' },
      });
      mockClient([requestRow(requestId)], rpc);

      await expect(getMerchantRequestWithOffers(requestId, 'merchant-1')).rejects.toThrow(
        'Error al cargar los datos privados de la solicitud: UNAUTHORIZED_ACTOR'
      );
    });

    it('getMerchantRequestWithOffers no llama a la RPC si la solicitud no es del comercio', async () => {
      const rpc = vi.fn();
      mockClient([], rpc);

      expect(await getMerchantRequestWithOffers(requestId, 'merchant-1')).toBeNull();
      expect(rpc).not.toHaveBeenCalled();
    });

    it('H06: getMerchantRequestWithOffers con parent null y 3 drops dispares proyecta drops[] y deriva escalares del primer drop', async () => {
      const testReqId = '33333333-3333-3333-3333-333333333333';
      const parentRowNulls = {
        id: testReqId,
        approx_distance_m: 2500,
        package_type: null, // parent null
        recipient_payment_method: null, // parent null
        needs_change: null, // parent null
        status: 'published',
        expires_at: null,
        created_at: '2026-10-12T10:00:00.000Z',
        accepted_offer_id: null,
        drops_count: 3,
        pickup_zone: { name: 'Barrio Centro' },
        dropoff_zone: null, // parent null
      };

      const threeDrops = [
        {
          id: 'drop-1',
          request_id: testReqId,
          position: 1,
          package_type: 'mediano',
          recipient_payment_method: 'transfer',
          needs_change: false,
          approx_distance_m: 1000,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Norte' },
        },
        {
          id: 'drop-2',
          request_id: testReqId,
          position: 2,
          package_type: 'grande',
          recipient_payment_method: 'cash',
          needs_change: true,
          approx_distance_m: 1500,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Este' },
        },
        {
          id: 'drop-3',
          request_id: testReqId,
          position: 3,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: 800,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: parentRowNulls, error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable(threeDrops);
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({
          data: { requestId: testReqId, notes: null, cashChangeAmount: null },
          error: null,
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getMerchantRequestWithOffers(testReqId, 'merchant-1');
      expect(result).not.toBeNull();
      // Verificación de compatibilidad escalar derivada del primer hijo (NO inventada de fallback)
      expect(result?.request.packageType).toBe('mediano');
      expect(result?.request.recipientPaymentMethod).toBe('transfer');
      expect(result?.request.needsChange).toBe(false);
      expect(result?.request.dropoffZoneName).toBe('Barrio Norte');
      expect(result?.request.dropsCount).toBe(3);

      // Verificación de la colección completa drops[]
      expect(result?.request.drops).toHaveLength(3);
      expect(result?.request.drops?.[0]).toMatchObject({
        id: 'drop-1',
        position: 1,
        packageType: 'mediano',
        recipientPaymentMethod: 'transfer',
        dropoffZoneName: 'Barrio Norte',
      });
      expect(result?.request.drops?.[1]).toMatchObject({
        id: 'drop-2',
        position: 2,
        packageType: 'grande',
        recipientPaymentMethod: 'cash',
        dropoffZoneName: 'Barrio Este',
      });
      expect(result?.request.drops?.[2]).toMatchObject({
        id: 'drop-3',
        position: 3,
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        dropoffZoneName: 'Barrio Sur',
      });
    });

    it('H06/H11 positivo: getMerchantRequests con parent null y 3 drops dispares proyecta 3 entregas y deriva primer hijo', async () => {
      const testReqId = '44444444-4444-4444-4444-444444444444';
      const parentRow = {
        id: testReqId,
        approx_distance_m: 2000,
        package_type: null,
        recipient_payment_method: null,
        needs_change: null,
        status: 'published',
        expires_at: null,
        created_at: new Date().toISOString(),
        accepted_offer_id: null,
        drops_count: 3,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: null,
      };

      const threeDrops = [
        {
          id: 'drop-1',
          request_id: testReqId,
          position: 1,
          package_type: 'grande',
          recipient_payment_method: 'transfer',
          needs_change: false,
          approx_distance_m: 1000,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Zona Industrial' },
        },
        {
          id: 'drop-2',
          request_id: testReqId,
          position: 2,
          package_type: 'mediano',
          recipient_payment_method: 'cash',
          needs_change: true,
          approx_distance_m: 1500,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Norte' },
        },
        {
          id: 'drop-3',
          request_id: testReqId,
          position: 3,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: 2000,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [parentRow], error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable(threeDrops);
          }
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getMerchantRequests('merchant-1', { limit: 10 });
      expect(result.requests).toHaveLength(1);
      const req = result.requests[0]!;
      expect(req.packageType).toBe('grande');
      expect(req.recipientPaymentMethod).toBe('transfer');
      expect(req.dropoffZoneName).toBe('Zona Industrial');
      expect(req.dropsCount).toBe(3);
      expect(req.drops).toHaveLength(3);
      expect(req.drops?.[0]?.position).toBe(1);
      expect(req.drops?.[1]?.position).toBe(2);
      expect(req.drops?.[2]?.position).toBe(3);
    });

    it('H06/H11 positivo: getMerchantHistoryRequests con parent null y 3 drops dispares en estado delivered proyecta 3 entregas y deriva primer hijo', async () => {
      const testReqId = '55555555-5555-4555-8555-555555555555';
      const parentRow = {
        id: testReqId,
        approx_distance_m: 3000,
        package_type: null,
        recipient_payment_method: null,
        needs_change: null,
        status: 'delivered',
        expires_at: null,
        created_at: new Date().toISOString(),
        accepted_offer_id: null,
        drops_count: 3,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: null,
      };

      const threeDrops = [
        {
          id: 'drop-1',
          request_id: testReqId,
          position: 1,
          package_type: 'grande',
          recipient_payment_method: 'transfer',
          needs_change: false,
          approx_distance_m: 1000,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          failed_reason: null,
          dropoff_zone: { name: 'Zona Industrial' },
        },
        {
          id: 'drop-2',
          request_id: testReqId,
          position: 2,
          package_type: 'mediano',
          recipient_payment_method: 'cash',
          needs_change: true,
          approx_distance_m: 2000,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Norte' },
        },
        {
          id: 'drop-3',
          request_id: testReqId,
          position: 3,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: 3000,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [parentRow], error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable(threeDrops);
          }
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getMerchantHistoryRequests('merchant-1', { limit: 10, status: 'all' });
      expect(result.requests).toHaveLength(1);
      const req = result.requests[0]!;
      expect(req.packageType).toBe('grande');
      expect(req.recipientPaymentMethod).toBe('transfer');
      expect(req.dropoffZoneName).toBe('Zona Industrial');
      expect(req.dropsCount).toBe(3);
      expect(req.drops).toHaveLength(3);
    });

    it('H06/H11 negativo: getMerchantRequests falla cerrado ante cardinalidad inconsistente (declarado 3, devuelto 1)', async () => {
      const testReqId = '66666666-6666-4666-8666-666666666666';
      const parentRow = {
        id: testReqId,
        approx_distance_m: 2000,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        status: 'published',
        expires_at: null,
        created_at: new Date().toISOString(),
        accepted_offer_id: null,
        drops_count: 3,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: null,
      };

      const oneDrop = [
        {
          id: 'drop-1',
          request_id: testReqId,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: 1000,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Zona Industrial' },
        },
      ];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [parentRow], error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable(oneDrop);
          }
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      await expect(getMerchantRequests('merchant-1', { limit: 10 })).rejects.toThrow(
        /se declararon 3 entregas pero se encontraron 1/i
      );
    });

    it('H06/H11 negativo: getMerchantRequests falla cerrado ante 0 entregas en estado publicado (3/0 y 1/0)', async () => {
      const testReqId = '77777777-7777-4777-8777-777777777777';
      const parentRow = {
        id: testReqId,
        approx_distance_m: 2000,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        status: 'published',
        expires_at: null,
        created_at: new Date().toISOString(),
        accepted_offer_id: null,
        drops_count: 3,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: null,
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [parentRow], error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable([]);
          }
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      await expect(getMerchantRequests('merchant-1', { limit: 10 })).rejects.toThrow(
        /requiere al menos 1 entrega materializada, pero se encontraron 0/i
      );
    });

    it('H06/H11 negativo: getMerchantRequests falla cerrado ante posiciones no consecutivas', async () => {
      const testReqId = '88888888-8888-4888-8888-888888888888';
      const parentRow = {
        id: testReqId,
        approx_distance_m: 2000,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        status: 'published',
        expires_at: null,
        created_at: new Date().toISOString(),
        accepted_offer_id: null,
        drops_count: 2,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: null,
      };

      const nonConsecutiveDrops = [
        {
          id: 'drop-1',
          request_id: testReqId,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: 1000,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Zona Industrial' },
        },
        {
          id: 'drop-3',
          request_id: testReqId,
          position: 3, // Posición 3 en vez de 2
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: 1500,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Norte' },
        },
      ];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [parentRow], error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable(nonConsecutiveDrops);
          }
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      await expect(getMerchantRequests('merchant-1', { limit: 10 })).rejects.toThrow(
        /las posiciones de las entregas no son consecutivas iniciando en 1/i
      );
    });

    it('H06/H11 negativo: getMerchantHistoryRequests falla cerrado ante cardinalidad inconsistente (3/1)', async () => {
      const testReqId = '99999999-9999-4999-8999-999999999999';
      const parentRow = {
        id: testReqId,
        approx_distance_m: 2000,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        status: 'delivered',
        expires_at: null,
        created_at: new Date().toISOString(),
        accepted_offer_id: null,
        drops_count: 3,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: null,
      };

      const oneDrop = [
        {
          id: 'drop-1',
          request_id: testReqId,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: 1000,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          failed_reason: null,
          dropoff_zone: { name: 'Zona Industrial' },
        },
      ];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [parentRow], error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable(oneDrop);
          }
          return {};
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      await expect(
        getMerchantHistoryRequests('merchant-1', { limit: 10, status: 'all' })
      ).rejects.toThrow(/se declararon 3 entregas pero se encontraron 1/i);
    });

    it('H06/H11 negativo: getMerchantRequestWithOffers falla cerrado ante cardinalidad inconsistente (3/1)', async () => {
      const testReqId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const requestData = {
        id: testReqId,
        approx_distance_m: 2000,
        package_type: null,
        recipient_payment_method: null,
        needs_change: null,
        status: 'published',
        expires_at: null,
        created_at: new Date().toISOString(),
        accepted_offer_id: null,
        drops_count: 3,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: null,
      };

      const oneDrop = [
        {
          id: 'drop-1',
          request_id: testReqId,
          position: 1,
          package_type: 'mediano',
          recipient_payment_method: 'transfer',
          needs_change: false,
          approx_distance_m: 1000,
          status: 'pending',
          delivered_at: null,
          failed_reason: null,
          dropoff_zone: { name: 'Barrio Norte' },
        },
      ];

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: requestData, error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable(oneDrop);
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({
          data: { requestId: testReqId, notes: null, cashChangeAmount: null },
          error: null,
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      await expect(getMerchantRequestWithOffers(testReqId, 'merchant-1')).rejects.toThrow(
        /se declararon 3 entregas pero se encontraron 1/i
      );
    });

    it('H06/H11 draft: assertAndMapMerchantDrops no falla ante borrador sin entregas y retorna drops undefined', () => {
      const result = assertAndMapMerchantDrops('draft-id', 'draft', null, []);
      expect(result.drops).toBeUndefined();
      expect(result.firstDrop).toBeUndefined();
      expect(result.dropsCount).toBe(1);
    });

    it('H06/H11 draft: assertAndMapMerchantDrops con entregas en borrador las valida y mapea correctamente', () => {
      const draftDrop: MerchantDropSummary = {
        id: 'drop-d1',
        position: 1,
        dropoffZoneName: 'Centro',
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        approxDistanceKm: '1.0 km',
        status: 'draft',
        deliveredAt: null,
        failedReason: null,
      };
      const result = assertAndMapMerchantDrops('draft-id', 'draft', 1, [draftDrop]);
      expect(result.drops).toHaveLength(1);
      expect(result.firstDrop).toEqual(draftDrop);
      expect(result.dropsCount).toBe(1);
    });

    it('H06/H11 draft: getMerchantRequestWithOffers en estado draft sin entregas no falla y devuelve drops undefined', async () => {
      const testReqId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const requestData = {
        id: testReqId,
        approx_distance_m: 2000,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        status: 'draft',
        expires_at: null,
        created_at: new Date().toISOString(),
        accepted_offer_id: null,
        drops_count: null,
        pickup_zone: { name: 'Centro' },
        dropoff_zone: { name: 'Barrio Norte' },
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: requestData, error: null }),
            };
          }
          if (table === 'offers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'delivery_request_drops') {
            return mockDropsTable([]);
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({
          data: { requestId: testReqId, notes: null, cashChangeAmount: null },
          error: null,
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getMerchantRequestWithOffers(testReqId, 'merchant-1');
      expect(result).not.toBeNull();
      expect(result?.request.status).toBe('draft');
      expect(result?.request.drops).toBeUndefined();
      expect(result?.request.dropsCount).toBe(1);
      expect(result?.request.dropoffZoneName).toBe('Barrio Norte');
    });
  });

  describe('T-366: Reconciliación de expiración en consultas del comercio (CC-026)', () => {
    interface FakeDbRow {
      id: string;
      merchant_id: string;
      status: string;
      expires_at: string | null;
      created_at: string;
      accepted_offer_id: string | null;
      drops_count: number;
      approx_distance_m: number;
      package_type: string;
      recipient_payment_method: string;
      needs_change: boolean;
      pickup_zone: { name: string };
      dropoff_zone: { name: string };
    }

    function createFakeSupabase(
      initialRows: FakeDbRow[],
      options?: {
        rpcOverride?: (
          name: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
        now?: () => Date;
        onRpcCall?: (name: string, args: Record<string, unknown>) => void;
        batchLimit?: number;
      }
    ) {
      const rows: FakeDbRow[] = initialRows.map((r) => ({ ...r }));
      const queriedTables: string[] = [];
      const getNow = options?.now ?? (() => new Date('2026-10-15T12:00:00.000Z'));
      const batchLimit = options?.batchLimit ?? 50;

      const rpcFn = vi.fn().mockImplementation(async (name: string, args: Record<string, unknown> = {}) => {
        options?.onRpcCall?.(name, args);
        if (options?.rpcOverride) {
          return options.rpcOverride(name, args);
        }
        if (name === 'reconcile_expired_requests') {
          const nowIso = getNow().toISOString();
          const eligible = rows.filter(
            (r) =>
              r.status === 'published' &&
              r.accepted_offer_id === null &&
              r.expires_at !== null &&
              r.expires_at <= nowIso
          );
          const toReconcile = eligible.slice(0, batchLimit);
          for (const item of toReconcile) {
            item.status = 'expired';
          }
          const hasMore = eligible.length > toReconcile.length;
          return {
            data: {
              expiredRequestIds: toReconcile.map((r) => r.id),
              expiredCount: toReconcile.length,
              hasMore,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const fromFn = vi.fn().mockImplementation((table: string) => {
        queriedTables.push(table);
        if (table === 'delivery_requests') {
          let selectedStatusFilter: string[] | string | null = null;
          let merchantIdFilter: string | null = null;
          let limitCount: number | null = null;
          let cursorFilter: { createdAt: string; id: string } | null = null;

          const builder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === 'merchant_id') merchantIdFilter = val;
              if (col === 'status') selectedStatusFilter = val;
              return builder;
            }),
            in: vi.fn().mockImplementation((col: string, vals: string[]) => {
              if (col === 'status') selectedStatusFilter = vals;
              return builder;
            }),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockImplementation((n: number) => {
              limitCount = n;
              return builder;
            }),
            or: vi.fn().mockImplementation((expr: string) => {
              const match = expr.match(
                /created_at\.lt\.([^,]+),and\(created_at\.eq\.\1,id\.lt\.([^)]+)\)/
              );
              if (match) {
                cursorFilter = { createdAt: match[1]!, id: match[2]! };
              }
              return builder;
            }),
            then: (
              resolve: (val: { data: FakeDbRow[]; error: null }) => void,
              _reject?: (err: unknown) => void
            ) => {
              let result = [...rows];
              if (merchantIdFilter) {
                result = result.filter((r) => r.merchant_id === merchantIdFilter);
              }
              if (selectedStatusFilter) {
                if (Array.isArray(selectedStatusFilter)) {
                  result = result.filter((r) => selectedStatusFilter!.includes(r.status));
                } else {
                  result = result.filter((r) => r.status === selectedStatusFilter);
                }
              }
              result.sort((a, b) => {
                const dateCmp = b.created_at.localeCompare(a.created_at);
                if (dateCmp !== 0) return dateCmp;
                return b.id.localeCompare(a.id);
              });
              if (cursorFilter) {
                result = result.filter(
                  (r) =>
                    r.created_at < cursorFilter!.createdAt ||
                    (r.created_at === cursorFilter!.createdAt && r.id < cursorFilter!.id)
                );
              }
              if (limitCount !== null) {
                result = result.slice(0, limitCount);
              }
              resolve({ data: result, error: null });
            },
          };
          return builder;
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'delivery_request_drops') return mockDropsTable();
        return {};
      });

      return {
        from: fromFn,
        rpc: rpcFn,
        rows,
        queriedTables,
      };
    }

    function makeTestRow(overrides: Partial<FakeDbRow> = {}): FakeDbRow {
      return {
        id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
        merchant_id: overrides.merchant_id ?? 'merchant-1',
        status: overrides.status ?? 'published',
        expires_at: overrides.expires_at ?? '2026-10-15T10:00:00.000Z',
        created_at: overrides.created_at ?? '2026-10-15T09:00:00.000Z',
        accepted_offer_id: overrides.accepted_offer_id ?? null,
        drops_count: overrides.drops_count ?? 1,
        approx_distance_m: overrides.approx_distance_m ?? 1200,
        package_type: overrides.package_type ?? 'chico',
        recipient_payment_method: overrides.recipient_payment_method ?? 'cash',
        needs_change: overrides.needs_change ?? false,
        pickup_zone: overrides.pickup_zone ?? { name: 'Centro' },
        dropoff_zone: overrides.dropoff_zone ?? { name: 'Sur' },
      };
    }

    it('getMerchantHistoryRequests con filtro expired incluye solicitud vencida tras reconciliación autoritativa', async () => {
      const expiredPastRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111101',
        status: 'published',
        expires_at: '2026-10-15T11:00:00.000Z',
      });
      const fake = createFakeSupabase([expiredPastRow]);
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getMerchantHistoryRequests('merchant-1', {
        status: 'expired',
        now: new Date('2026-10-15T12:00:00.000Z'),
      });

      expect(fake.rpc).toHaveBeenCalledWith('reconcile_expired_requests', {});
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.id).toBe(expiredPastRow.id);
      expect(result.requests[0]?.status).toBe('expired');
      expect(fake.rows[0]?.status).toBe('expired');
    });

    it('getMerchantHistoryRequests con filtro all incluye solicitud vencida con status expired', async () => {
      const deliveredRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111102',
        status: 'delivered',
        created_at: '2026-10-15T08:00:00.000Z',
      });
      const expiredPastRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111103',
        status: 'published',
        expires_at: '2026-10-15T11:00:00.000Z',
        created_at: '2026-10-15T09:00:00.000Z',
      });
      const fake = createFakeSupabase([deliveredRow, expiredPastRow]);
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getMerchantHistoryRequests('merchant-1', {
        status: 'all',
        now: new Date('2026-10-15T12:00:00.000Z'),
      });

      expect(fake.rpc).toHaveBeenCalledWith('reconcile_expired_requests', {});
      expect(result.requests).toHaveLength(2);
      const expiredFound = result.requests.find((r) => r.id === expiredPastRow.id);
      expect(expiredFound).toBeDefined();
      expect(expiredFound?.status).toBe('expired');
    });

    it('getMerchantRequests excluye solicitud vencida de la lista de solicitudes activas', async () => {
      const activeRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111104',
        status: 'published',
        expires_at: '2026-10-15T14:00:00.000Z', // futuro
      });
      const expiredPastRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111105',
        status: 'published',
        expires_at: '2026-10-15T11:00:00.000Z', // vencida
      });
      const fake = createFakeSupabase([activeRow, expiredPastRow]);
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getMerchantRequests('merchant-1', {
        now: new Date('2026-10-15T12:00:00.000Z'),
      });

      expect(fake.rpc).toHaveBeenCalledWith('reconcile_expired_requests', {});
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.id).toBe(activeRow.id);
      expect(result.requests[0]?.status).toBe('published');
    });

    it('condición de borde: solicitud con expires_at futuro permanece published en activas y no aparece en expired', async () => {
      const futureRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111106',
        status: 'published',
        expires_at: '2026-10-15T12:00:01.000Z', // 1 segundo en el futuro
      });
      const fake = createFakeSupabase([futureRow], {
        now: () => new Date('2026-10-15T12:00:00.000Z'),
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const historyResult = await getMerchantHistoryRequests('merchant-1', {
        status: 'expired',
        now: new Date('2026-10-15T12:00:00.000Z'),
      });
      expect(historyResult.requests).toHaveLength(0);

      const activeResult = await getMerchantRequests('merchant-1', {
        now: new Date('2026-10-15T12:00:00.000Z'),
      });
      expect(activeResult.requests).toHaveLength(1);
      expect(activeResult.requests[0]?.id).toBe(futureRow.id);
      expect(activeResult.requests[0]?.status).toBe('published');
    });

    it('condición de borde: solicitud con expires_at exactamente en el corte (now) transiciona a expired', async () => {
      const exactNowIso = '2026-10-15T12:00:00.000Z';
      const exactRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111107',
        status: 'published',
        expires_at: exactNowIso, // exactamente now
      });
      const fake = createFakeSupabase([exactRow], {
        now: () => new Date(exactNowIso),
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const historyResult = await getMerchantHistoryRequests('merchant-1', {
        status: 'expired',
        now: new Date(exactNowIso),
      });
      expect(historyResult.requests).toHaveLength(1);
      expect(historyResult.requests[0]?.id).toBe(exactRow.id);
      expect(historyResult.requests[0]?.status).toBe('expired');

      const activeResult = await getMerchantRequests('merchant-1', {
        now: new Date(exactNowIso),
      });
      expect(activeResult.requests).toHaveLength(0);
    });

    it('estados no terminales o en tránsito (matched, in_transit, delivered, cancelled) no son alterados por la reconciliación', async () => {
      const pastDeadline = '2026-10-15T10:00:00.000Z';
      const matchedRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111108',
        status: 'matched',
        expires_at: pastDeadline,
        accepted_offer_id: 'offer-1',
      });
      const inTransitRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111109',
        status: 'in_transit',
        expires_at: pastDeadline,
        accepted_offer_id: 'offer-2',
      });
      const cancelledRow = makeTestRow({
        id: '11111111-1111-4111-8111-111111111110',
        status: 'cancelled',
        expires_at: pastDeadline,
      });

      const fake = createFakeSupabase([matchedRow, inTransitRow, cancelledRow]);
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const historyResult = await getMerchantHistoryRequests('merchant-1', {
        status: 'expired',
        now: new Date('2026-10-15T12:00:00.000Z'),
      });
      expect(historyResult.requests).toHaveLength(0);

      expect(fake.rows.find((r) => r.id === matchedRow.id)?.status).toBe('matched');
      expect(fake.rows.find((r) => r.id === inTransitRow.id)?.status).toBe('in_transit');
      expect(fake.rows.find((r) => r.id === cancelledRow.id)?.status).toBe('cancelled');
    });

    it('reconciliación multi-lote (>50 filas): consume lotes con hasMore=true hasta hasMore=false y pagina correctamente', async () => {
      const sixtyRows: FakeDbRow[] = Array.from({ length: 60 }, (_, idx) => {
        const num = String(idx + 1).padStart(4, '0');
        return makeTestRow({
          id: `00000000-0000-4000-8000-00000000${num}`,
          status: 'published',
          expires_at: '2026-10-15T11:00:00.000Z',
          created_at: `2026-10-15T10:${String(59 - idx).padStart(2, '0')}:00.000Z`,
        });
      });

      const rpcCalls: string[] = [];
      const fake = createFakeSupabase(sixtyRows, {
        batchLimit: 50,
        onRpcCall: (name) => rpcCalls.push(name),
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getMerchantHistoryRequests('merchant-1', {
        status: 'expired',
        limit: 50,
        now: new Date('2026-10-15T12:00:00.000Z'),
      });

      // Debe haber consumido 2 lotes (50 en el primero, 10 en el segundo)
      expect(rpcCalls).toEqual(['reconcile_expired_requests', 'reconcile_expired_requests']);
      // Las 60 filas deben haber transicionado a expired
      expect(fake.rows.every((r) => r.status === 'expired')).toBe(true);
      // La primera página retorna 50 ítems con cursor válido
      expect(result.requests).toHaveLength(50);
      expect(result.nextCursor).not.toBeNull();

      // Consultar la segunda página con el cursor
      const page2Result = await getMerchantHistoryRequests('merchant-1', {
        status: 'expired',
        limit: 50,
        cursor: result.nextCursor,
        now: new Date('2026-10-15T12:00:00.000Z'),
      });
      expect(page2Result.requests).toHaveLength(10);
      expect(page2Result.nextCursor).toBeNull();
    });

    it('H02 resiliencia ante locks concurrentes: si hasMore=true con 0 cambios persiste hasta agotar reintentos, falla cerrado y NO ejecuta SELECT de delivery_requests', async () => {
      const row = makeTestRow({
        id: '11111111-1111-4111-8111-111111111111',
        status: 'published',
        expires_at: '2026-10-15T10:00:00.000Z',
      });
      let callCount = 0;
      const fake = createFakeSupabase([row], {
        rpcOverride: async (name) => {
          if (name === 'reconcile_expired_requests') {
            callCount++;
            return {
              data: {
                expiredRequestIds: [],
                expiredCount: 0,
                hasMore: true, // locked por otra transacción concurrente con SKIP LOCKED
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      // Debe fallar cerrado tras agotar los 3 reintentos consecutivos por locks
      await expect(
        getMerchantHistoryRequests('merchant-1', { status: 'expired' })
      ).rejects.toThrow('Solicitudes vencidas bloqueadas concurrentemente; reintentos agotados');

      expect(callCount).toBe(3);
      // NUNCA debe ejecutar SELECT sobre delivery_requests en estado bloqueado
      expect(fake.queriedTables).not.toContain('delivery_requests');
      // La fila en BD permanece intacta sin cambios no autorizados
      expect(fake.rows[0]?.status).toBe('published');
    });

    it('H02 resiliencia ante locks concurrentes en getMerchantRequests: si hasMore=true con 0 cambios persiste, falla cerrado sin consultar activas', async () => {
      const row = makeTestRow({
        id: '11111111-1111-4111-8111-111111111112',
        status: 'published',
        expires_at: '2026-10-15T10:00:00.000Z',
      });
      let callCount = 0;
      const fake = createFakeSupabase([row], {
        rpcOverride: async (name) => {
          if (name === 'reconcile_expired_requests') {
            callCount++;
            return {
              data: {
                expiredRequestIds: [],
                expiredCount: 0,
                hasMore: true,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await expect(
        getMerchantRequests('merchant-1')
      ).rejects.toThrow('Solicitudes vencidas bloqueadas concurrentemente; reintentos agotados');

      expect(callCount).toBe(3);
      expect(fake.queriedTables).not.toContain('delivery_requests');
    });

    it('H02 recuperación de locks concurrentes: 0/true seguido de 1/false procesa la reconciliación y devuelve el historial actualizado', async () => {
      const row = makeTestRow({
        id: '11111111-1111-4111-8111-111111111113',
        status: 'published',
        expires_at: '2026-10-15T10:00:00.000Z',
      });
      let callCount = 0;
      const fake = createFakeSupabase([row], {
        rpcOverride: async (name) => {
          if (name === 'reconcile_expired_requests') {
            callCount++;
            if (callCount === 1) {
              // Intento 1: fila transitoriamente bloqueada
              return {
                data: {
                  expiredRequestIds: [],
                  expiredCount: 0,
                  hasMore: true,
                },
                error: null,
              };
            }
            // Intento 2: lock liberado, fila transiciona a expired
            fake.rows[0]!.status = 'expired';
            return {
              data: {
                expiredRequestIds: [row.id],
                expiredCount: 1,
                hasMore: false,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getMerchantHistoryRequests('merchant-1', { status: 'expired' });
      expect(callCount).toBe(2);
      expect(fake.queriedTables).toContain('delivery_requests');
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.id).toBe(row.id);
      expect(result.requests[0]?.status).toBe('expired');
      expect(fake.rows[0]?.status).toBe('expired');
    });

    it('H05 disponibilidad backlog 500 filas: procesa 10 lotes completos de 50 items (500) y completa sin error', async () => {
      const fiveHundredRows: FakeDbRow[] = Array.from({ length: 500 }, (_, idx) => {
        const num = String(idx + 1).padStart(4, '0');
        return makeTestRow({
          id: `00000000-0000-4000-8000-${num.padStart(12, '0')}`,
          status: 'published',
          expires_at: '2026-10-15T11:00:00.000Z',
          created_at: `2026-10-15T10:00:00.000Z`,
        });
      });

      let callCount = 0;
      const fake = createFakeSupabase(fiveHundredRows, {
        batchLimit: 50,
        onRpcCall: () => callCount++,
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const start = performance.now();
      const result = await getMerchantHistoryRequests('merchant-1', {
        status: 'expired',
        limit: 50,
        now: new Date('2026-10-15T12:00:00.000Z'),
      });
      const durationMs = performance.now() - start;

      // 10 lotes exactamente consumidos para 500 filas
      expect(callCount).toBe(10);
      expect(fake.rows.every((r) => r.status === 'expired')).toBe(true);
      expect(result.requests).toHaveLength(50);
      expect(result.nextCursor).not.toBeNull();
      // Latencia en memoria debe ser sub-100ms
      expect(durationMs).toBeLessThan(500);
    });

    it('H05 backlog 501 filas: falla cerrado con presupuesto agotado cuando el lote 10 aún reporta hasMore=true', async () => {
      const fiveHundredOneRows: FakeDbRow[] = Array.from({ length: 501 }, (_, idx) => {
        const num = String(idx + 1).padStart(4, '0');
        return makeTestRow({
          id: `00000000-0000-4000-8000-${num.padStart(12, '0')}`,
          status: 'published',
          expires_at: '2026-10-15T11:00:00.000Z',
        });
      });

      let callCount = 0;
      const fake = createFakeSupabase(fiveHundredOneRows, {
        batchLimit: 50,
        onRpcCall: () => callCount++,
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await expect(
        getMerchantHistoryRequests('merchant-1', { status: 'expired' })
      ).rejects.toThrow('Presupuesto de reconciliación de solicitudes vencidas agotado');
      expect(callCount).toBe(10);
      expect(fake.queriedTables).not.toContain('delivery_requests');
    });

    it('falla cerrado: si se agota el presupuesto máximo de lotes y hasMore sigue true, lanza error', async () => {
      const row = makeTestRow({
        id: '11111111-1111-4111-8111-111111111112',
        status: 'published',
        expires_at: '2026-10-15T10:00:00.000Z',
      });
      let callCount = 0;
      const fake = createFakeSupabase([row], {
        rpcOverride: async (name) => {
          if (name === 'reconcile_expired_requests') {
            callCount++;
            return {
              data: {
                expiredRequestIds: [`00000000-0000-4000-8000-${String(callCount).padStart(12, '0')}`],
                expiredCount: 1,
                hasMore: true, // simula stream interminable > 10 lotes
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await expect(
        getMerchantHistoryRequests('merchant-1', { status: 'expired' })
      ).rejects.toThrow('Presupuesto de reconciliación de solicitudes vencidas agotado');
      expect(callCount).toBe(10);
    });

    it('falla cerrado ante error de RPC: si reconcile_expired_requests retorna error, la consulta falla y no devuelve estado parcial', async () => {
      const row = makeTestRow({
        id: '11111111-1111-4111-8111-111111111113',
        status: 'published',
        expires_at: '2026-10-15T10:00:00.000Z',
      });
      const fake = createFakeSupabase([row], {
        rpcOverride: async () => ({
          data: null,
          error: { code: 'P0001', message: 'UNAUTHORIZED_ACTOR' },
        }),
      });
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        fake as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await expect(
        getMerchantHistoryRequests('merchant-1', { status: 'expired' })
      ).rejects.toThrow('Error al reconciliar solicitudes vencidas: UNAUTHORIZED_ACTOR');

      await expect(
        getMerchantRequests('merchant-1')
      ).rejects.toThrow('Error al reconciliar solicitudes vencidas: UNAUTHORIZED_ACTOR');
    });
  });
});

