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
          // Query global de métricas (60 filas completas)
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: allSixtyRows, error: null }),
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
          dropoff_zone: { name: 'Sur' },
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

      let deliveryCallCount = 0;
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          deliveryCallCount += 1;
          if (deliveryCallCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
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
  });
});
