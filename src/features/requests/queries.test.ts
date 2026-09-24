import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getActiveZones, getMerchantDefaultPickup } from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-112: queries de requests', () => {
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

    it('devuelve array vacío ante error de base', async () => {
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

      const zones = await getActiveZones();
      expect(zones).toEqual([]);
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

    it('retorna null si no encuentra el comercio o ante error', async () => {
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
});
