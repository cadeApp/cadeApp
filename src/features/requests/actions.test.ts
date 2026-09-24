import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { createDeliveryRequestAction } from './actions';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-112: createDeliveryRequestAction y cálculo de distancia server-side', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPickupZoneId = '11111111-1111-4111-8111-111111111111';
  const validDropoffZoneId = '22222222-2222-4222-8222-222222222222';

  const validFormInput = {
    pickupZoneId: validPickupZoneId,
    pickupAddress: 'Av. Sarmiento 120',
    pickupLat: -27.43,
    pickupLng: -65.61,
    dropoffZoneId: validDropoffZoneId,
    dropoffAddress: 'San Martín 450',
    dropoffLat: -27.435,
    dropoffLng: -65.615,
    recipientName: 'Juan Pérez',
    recipientPhone: '3815551234',
    recipientConsentDeclared: true,
    packageType: 'mediano' as const,
    recipientPaymentMethod: 'cash' as const,
    needsChange: true,
    cashChangeAmount: 5000,
    notes: 'Tocar timbre blanco',
  };

  it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await createDeliveryRequestAction(validFormInput);
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

    const result = await createDeliveryRequestAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED_ACTOR');
    }
  });

  it('bloquea la creación si el comercio no tiene piloto ni suscripción activa con SUBSCRIPTION_INACTIVE', async () => {
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
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              subscription_status: 'expired',
              paid_until: '2026-01-01',
            },
            error: null,
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { key: 'pilot_active', value: false },
              { key: 'subscription_grace_days', value: 0 },
            ],
            error: null,
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await createDeliveryRequestAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SUBSCRIPTION_INACTIVE');
    }
  });

  it('rechaza input inválido con VALIDATION_ERROR', async () => {
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
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              subscription_status: 'pilot',
              paid_until: null,
            },
            error: null,
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { key: 'pilot_active', value: true },
              { key: 'subscription_grace_days', value: 0 },
            ],
            error: null,
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const invalidInput = {
      ...validFormInput,
      pickupAddress: '', // Vacío
    };

    const result = await createDeliveryRequestAction(invalidInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('crea solicitud exitosa con coordenadas exactas, cálculo Haversine y guarda cash_change_amount', async () => {
    let insertedRequest: Record<string, unknown> | null = null;
    let insertedContacts: Record<string, unknown> | null = null;

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
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              subscription_status: 'pilot',
              paid_until: null,
            },
            error: null,
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { key: 'pilot_active', value: true },
              { key: 'subscription_grace_days', value: 0 },
            ],
            error: null,
          }),
        };
      }
      if (table === 'delivery_requests') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedRequest = payload;
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'req-uuid-123' },
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'delivery_request_contacts') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedContacts = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await createDeliveryRequestAction(validFormInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.requestId).toBe('req-uuid-123');
      expect(result.data.redirectTo).toBe('/merchant/requests');
    }

    // Verificación 1: delivery_requests contiene status draft, package_type, cambio y distancia calculada
    expect(insertedRequest).toMatchObject({
      merchant_id: 'usr-merchant-1',
      pickup_zone_id: validPickupZoneId,
      dropoff_zone_id: validDropoffZoneId,
      package_type: 'mediano',
      recipient_payment_method: 'cash',
      needs_change: true,
      cash_change_amount: 5000,
      notes: 'Tocar timbre blanco',
      status: 'draft',
    });
    expect(
      typeof (insertedRequest as unknown as { route_distance_m: number }).route_distance_m
    ).toBe('number');
    expect(
      (insertedRequest as unknown as { route_distance_m: number }).route_distance_m
    ).toBeGreaterThan(0);

    // Verificación 2: delivery_request_contacts contiene datos protegidos
    expect(insertedContacts).toMatchObject({
      request_id: 'req-uuid-123',
      pickup_address: 'Av. Sarmiento 120',
      pickup_lat: -27.43,
      pickup_lng: -65.61,
      dropoff_address: 'San Martín 450',
      dropoff_lat: -27.435,
      dropoff_lng: -65.615,
      recipient_name: 'Juan Pérez',
      recipient_phone: '3815551234',
      recipient_consent_declared: true,
    });
  });

  it('fallback a centroides de zones cuando no se proporcionan coordenadas', async () => {
    let insertedRequest: Record<string, unknown> | null = null;

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
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              subscription_status: 'pilot',
              paid_until: null,
            },
            error: null,
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { key: 'pilot_active', value: true },
              { key: 'subscription_grace_days', value: 0 },
            ],
            error: null,
          }),
        };
      }
      if (table === 'zones') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: validPickupZoneId, centroid_lat: -27.43, centroid_lng: -65.61 },
              { id: validDropoffZoneId, centroid_lat: -27.44, centroid_lng: -65.62 },
            ],
            error: null,
          }),
        };
      }
      if (table === 'delivery_requests') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedRequest = payload;
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'req-zone-fallback-456' },
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'delivery_request_contacts') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const withoutCoords = {
      ...validFormInput,
      pickupLat: null,
      pickupLng: null,
      dropoffLat: null,
      dropoffLng: null,
    };

    const result = await createDeliveryRequestAction(withoutCoords);
    expect(result.ok).toBe(true);

    // Se calculó la distancia basada en los centroides de zones
    expect(insertedRequest).not.toBeNull();
    expect(
      (insertedRequest as unknown as { route_distance_m: number }).route_distance_m
    ).toBeGreaterThan(0);
  });
});
