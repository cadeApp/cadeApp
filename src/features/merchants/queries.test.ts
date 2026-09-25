import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getActiveZones, getMerchantAccountProfile } from './queries';
import { getSubscriptionDisplay, type MerchantSubscriptionStatus } from './copy';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-111 / T-118: queries de merchants y estado de suscripción (C08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna la lista de zonas activas ordenada', async () => {
    const mockZones = [
      { id: 'z1', name: 'Barrio Centro' },
      { id: 'z2', name: 'Barrio San Martín' },
    ];

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockZones, error: null }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const zones = await getActiveZones();
    expect(zones).toEqual(mockZones);
  });

  it('PR87-H06: propaga error de Supabase en getActiveZones para activar error.tsx y devuelve [] ante 0 filas sin error', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValueOnce({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    await expect(getActiveZones()).rejects.toThrow(/Error al consultar zonas/);

    vi.mocked(serverSupabase.createClient).mockResolvedValueOnce({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    await expect(getActiveZones()).resolves.toEqual([]);
  });

  it.each(['pilot', 'active', 'expired', 'cancelled'] as const)(
    'PR87-H02: getMerchantAccountProfile y getSubscriptionDisplay soportan el estado real de DB "%s"',
    async (status) => {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-merchant-1' } },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'merchants') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  business_name: 'Panadería La Espiga',
                  default_pickup_address: 'San Martín 450',
                  default_pickup_zone_id: 'z1',
                  notes: 'Timbre blanco',
                  subscription_status: status,
                  paid_until: '2026-12-31',
                  zones: { name: 'Centro' },
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { display_name: 'Juan', phone: '3815550123' },
              error: null,
            }),
          };
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const profile = await getMerchantAccountProfile();
      expect(profile).not.toBeNull();
      expect(profile?.subscriptionStatus).toBe(status);
      expect(profile?.paidUntil).toBe('2026-12-31');

      const display = getSubscriptionDisplay(status, profile?.paidUntil ?? null);
      expect(display.headline.length).toBeGreaterThan(5);
      expect(display.badgeLabel.length).toBeGreaterThan(3);
      expect(display.untilLabel).toBe('31 de diciembre de 2026');
    }
  );

  it('PR87-H02 / H06: lanza error ante fallo DB en getMerchantAccountProfile, devuelve null si no hay comercio y rechaza estados fuera de contrato como "trial"', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'connection refused' },
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    await expect(getMerchantAccountProfile()).rejects.toThrow(/Error al consultar comercio/);

    vi.mocked(serverSupabase.createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    await expect(getMerchantAccountProfile()).resolves.toBeNull();

    expect(() =>
      getSubscriptionDisplay('trial' as unknown as MerchantSubscriptionStatus, null)
    ).toThrow(/Estado de suscripción no soportado/);
  });
});
