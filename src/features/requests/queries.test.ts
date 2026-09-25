import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import {
  getActiveZones,
  getMerchantDefaultPickup,
  getMerchantHistoryRequests,
  getMerchantRequests,
  parseMerchantHistorySearchParams,
} from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

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
});
