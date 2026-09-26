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
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB query error') }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(500);
        expect(result.error).toBe('DATABASE_ERROR');
      }
    });

    it('retorna [] válido si hay 0 solicitudes publicadas', async () => {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getAvailableRequestsLiveServer();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
      }
    });

    it('retorna 500 si falla la consulta de offers', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: validUuid,
                      approx_distance_m: 1200,
                      package_type: 'small',
                      recipient_payment_method: 'cash',
                      needs_change: false,
                      cash_change_amount: null,
                      notes: null,
                      published_at: '2026-09-26T12:00:00Z',
                      expires_at: null,
                      pickup_zone: { name: 'Centro' },
                      dropoff_zone: { name: 'Aguilares' },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: null, error: new Error('Offers query error') }),
                }),
              }),
            }),
          };
        }
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
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: validUuid,
                      approx_distance_m: 1500,
                      package_type: 'small',
                      recipient_payment_method: 'cash',
                      needs_change: false,
                      cash_change_amount: null,
                      notes: null,
                      published_at: '2026-09-26T12:00:00Z',
                      expires_at: null,
                      pickup_zone: { name: 'Centro' },
                      dropoff_zone: { name: 'Aguilares' },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [{ request_id: validUuid, amount_ars: 1800 }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
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
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.hasMyOffer).toBe(true);
        expect(result.data[0]?.myOfferAmountArs).toBe(1800);
        expect(result.data[0]?.approxDistanceKm).toBe('1,5');
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
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
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

    it('happy path: retorna ofertas de la solicitud perteneciente al merchant', async () => {
      const offerId = '22222222-2222-2222-2222-222222222222';
      const courierId = '33333333-3333-3333-3333-333333333333';

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
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
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: offerId,
                      courier_id: courierId,
                      amount_ars: 2000,
                      eta_minutes: 15,
                      message: 'Listo para retirar',
                      status: 'pending',
                      created_at: '2026-09-26T12:10:00Z',
                      courier: {
                        vehicle_type: 'motorcycle',
                        license_status: 'verified',
                        insurance_status: 'none',
                        doc_level: 1,
                        profile: { display_name: 'Juan Repartidor' },
                      },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.courierName).toBe('Juan Repartidor');
        expect(result.data[0]?.amountArs).toBe(2000);
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
});
