import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { createDeliveryRequestAction } from './actions';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

// #209: `callRequestRpc` corre real. Solo se aíslan sus efectos post-commit (push y alertas).
vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  })),
}));

vi.mock('@/server/push', () => ({
  safeNotifyPostTransition: vi.fn(),
}));

vi.mock('@/server/observability', () => ({
  sendCriticalAlert: vi.fn(),
}));

type MockedServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;

const PUBLISHED_AT = '2026-10-02T12:00:00.000Z';
const EXPIRES_AT = '2026-10-02T12:30:00.000Z';

/** Respuesta de `publish_request` con la forma del contrato (`publishRequestOutputSchema`). */
function publishedRpcResponse(requestId: string) {
  return {
    data: {
      requestId,
      status: 'published',
      publishedAt: PUBLISHED_AT,
      expiresAt: EXPIRES_AT,
      routeDistanceM: 1000,
    },
    error: null,
  };
}

/** Rechazo de dominio tal como lo emite Postgres: `raise exception '<CODE>' using errcode = 'P0001'`. */
function rejectedRpcResponse(code: string) {
  return { data: null, error: { code: 'P0001', message: code } };
}

describe('T-112: createDeliveryRequestAction y cálculo de distancia server-side', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPickupZoneId = '11111111-1111-4111-8111-111111111111';
  const validDropoffZoneId = '22222222-2222-4222-8222-222222222222';
  const createdRequestId = '33333333-3333-4333-8333-333333333333';
  const fallbackRequestId = '44444444-4444-4444-8444-444444444444';

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
    const mockRpc = vi.fn().mockResolvedValue(publishedRpcResponse(createdRequestId));

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
                data: { id: createdRequestId },
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
      rpc: mockRpc,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await createDeliveryRequestAction(validFormInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.requestId).toBe(createdRequestId);
      expect(result.data.redirectTo).toBe('/merchant/requests');
    }
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('publish_request', { p_request_id: createdRequestId });

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
      request_id: createdRequestId,
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
                data: { id: fallbackRequestId },
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
      rpc: vi.fn().mockResolvedValue(publishedRpcResponse(fallbackRequestId)),
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

  // =========================================================================
  // #209: el alta llega a la RPC `publish_request`, que decide la transición
  // =========================================================================
  describe('#209: publicación real vía RPC publish_request', () => {
    interface FlowOptions {
      readonly merchant: { subscription_status: string; paid_until: string | null } | null;
      readonly pilotActive: boolean;
      readonly rpcResponse: unknown;
    }

    function mockCreateFlow({ merchant, pilotActive, rpcResponse }: FlowOptions) {
      const calls: string[] = [];
      const mockRpc = vi.fn().mockImplementation((fn: string) => {
        calls.push(`rpc:${fn}`);
        return Promise.resolve(rpcResponse);
      });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: merchant, error: null }),
          };
        }
        if (table === 'platform_settings') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { key: 'pilot_active', value: pilotActive },
                { key: 'subscription_grace_days', value: 0 },
              ],
              error: null,
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            insert: vi.fn().mockImplementation(() => {
              calls.push('insert:delivery_requests');
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: createdRequestId }, error: null }),
              };
            }),
          };
        }
        if (table === 'delivery_request_contacts') {
          return {
            insert: vi.fn().mockImplementation(() => {
              calls.push('insert:delivery_request_contacts');
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
        rpc: mockRpc,
      } as unknown as MockedServerClient);

      return { calls, mockRpc };
    }

    const pilotMerchant = { subscription_status: 'pilot', paid_until: null };
    const expiredMerchant = { subscription_status: 'expired', paid_until: '2026-01-01' };

    it('publica la solicitud recién creada: llama a publish_request después de guardar el contacto', async () => {
      const { calls, mockRpc } = mockCreateFlow({
        merchant: pilotMerchant,
        pilotActive: true,
        rpcResponse: publishedRpcResponse(createdRequestId),
      });

      const result = await createDeliveryRequestAction(validFormInput);

      expect(result).toEqual({
        ok: true,
        data: { requestId: createdRequestId, redirectTo: '/merchant/requests' },
      });
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('publish_request', { p_request_id: createdRequestId });
      // La RPC exige el contacto ya guardado (MISSING_REQUIRED_FIELDS si no): el orden importa.
      expect(calls).toEqual([
        'insert:delivery_requests',
        'insert:delivery_request_contacts',
        'rpc:publish_request',
      ]);
    });

    it('no anuncia éxito si publish_request rechaza: propaga SUBSCRIPTION_INACTIVE de la RPC', async () => {
      // El comercio "parece" habilitado para cualquier chequeo previo de la action (piloto activo):
      // el único que puede producir este código acá es la RPC.
      const { mockRpc } = mockCreateFlow({
        merchant: pilotMerchant,
        pilotActive: true,
        rpcResponse: rejectedRpcResponse('SUBSCRIPTION_INACTIVE'),
      });

      const result = await createDeliveryRequestAction(validFormInput);

      expect(result).toEqual({ ok: false, code: 'SUBSCRIPTION_INACTIVE' });
      expect(mockRpc).toHaveBeenCalledWith('publish_request', { p_request_id: createdRequestId });
    });

    it('un comercio con suscripción vencida igual alcanza la RPC: la action no decide por ella', async () => {
      const { mockRpc } = mockCreateFlow({
        merchant: expiredMerchant,
        pilotActive: false,
        rpcResponse: rejectedRpcResponse('SUBSCRIPTION_INACTIVE'),
      });

      const result = await createDeliveryRequestAction(validFormInput);

      expect(result).toEqual({ ok: false, code: 'SUBSCRIPTION_INACTIVE' });
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('publish_request', { p_request_id: createdRequestId });
    });

    it.each(['RATE_LIMITED', 'OUT_OF_BOUNDS_AGUILARES', 'INVALID_ZONE', 'MISSING_REQUIRED_FIELDS'])(
      'propaga el código de dominio %s que devuelve publish_request',
      async (code) => {
        mockCreateFlow({
          merchant: pilotMerchant,
          pilotActive: true,
          rpcResponse: rejectedRpcResponse(code),
        });

        const result = await createDeliveryRequestAction(validFormInput);

        expect(result).toEqual({ ok: false, code });
      }
    );

    it('devuelve INTERNAL_ERROR si la RPC responde algo que no es una solicitud publicada', async () => {
      mockCreateFlow({
        merchant: pilotMerchant,
        pilotActive: true,
        rpcResponse: { data: { requestId: createdRequestId, status: 'draft' }, error: null },
      });

      const result = await createDeliveryRequestAction(validFormInput);

      expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    });
  });
});
