import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { merchantOnboardingAction } from './actions';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-111: Merchant onboarding action y persistencia de piloto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validFormInput = {
    businessName: 'Panadería La Espiga',
    phone: '3815550123',
    defaultPickupAddress: 'San Martín 450',
    defaultPickupZoneId: '11111111-1111-1111-1111-111111111111',
    defaultPickupLat: -27.43,
    defaultPickupLng: -65.61,
    notes: 'Al lado de la plaza',
    acceptPilotTerms: true,
  };

  it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rechaza si el usuario no tiene rol merchant con UNAUTHORIZED_ACTOR', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'courier' }, // No es merchant
            error: null,
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-courier-1', email: 'courier@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED_ACTOR');
    }
  });

  it('rechaza datos inválidos (coordenadas fuera de Aguilares) con VALIDATION_ERROR', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const invalidCoordsInput = {
      ...validFormInput,
      defaultPickupLat: -34.6, // Buenos Aires
      defaultPickupLng: -58.38,
    };

    const result = await merchantOnboardingAction(invalidCoordsInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('alta exitosa: el comercio queda en pilot, se guarda versión de consentimiento y actualiza perfil', async () => {
    let insertedMerchant: unknown = null;
    let insertedConsent: unknown = null;
    let updatedProfile: unknown = null;

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
          update: vi.fn().mockImplementation((payload) => {
            updatedProfile = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { key: 'pilot_terms_version', value: '1.2' },
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedConsent = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'merchants') {
        return {
          upsert: vi.fn().mockImplementation((payload) => {
            insertedMerchant = payload;
            return Promise.resolve({ error: null });
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedMerchant = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/merchant/dashboard');
    }

    // Verificación 1: el comercio queda en subscription_status = 'pilot'
    expect(insertedMerchant).toMatchObject({
      profile_id: 'usr-merchant-1',
      business_name: 'Panadería La Espiga',
      subscription_status: 'pilot',
      paid_until: null,
      default_pickup_address: 'San Martín 450',
      default_pickup_lat: -27.43,
      default_pickup_lng: -65.61,
      default_pickup_zone_id: '11111111-1111-1111-1111-111111111111',
      notes: 'Al lado de la plaza',
    });

    // Verificación 2: versión de consentimiento guardada en consents
    expect(insertedConsent).toMatchObject({
      profile_id: 'usr-merchant-1',
      document: 'pilot_terms',
      version: '1.2',
    });

    // Verificación 3: perfil actualizado con display_name y phone
    expect(updatedProfile).toMatchObject({
      display_name: 'Panadería La Espiga',
      phone: '3815550123',
    });
  });

  it('mapea errores de base de datos a DomainErrorCode', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { value: '1.0' },
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'merchants') {
        return {
          upsert: vi.fn().mockResolvedValue({
            error: { message: 'Database error', code: '500' },
          }),
          insert: vi.fn().mockResolvedValue({
            error: { message: 'Database error', code: '500' },
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INTERNAL_ERROR');
    }
  });
});
