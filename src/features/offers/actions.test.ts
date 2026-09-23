import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as offersRpc from '@/server/rpc/offers';
import { submitOfferAction, withdrawOfferAction } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/rpc/offers', () => ({
  submitOfferRpc: vi.fn(),
  withdrawOfferRpc: vi.fn(),
}));

describe('T-114 DoD: actions de ofertas (submitOfferAction y withdrawOfferAction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validCourierUser = { id: 'courier-uuid-1', email: 'courier@test.com' };

  const validSubmitInput = {
    requestId: '22222222-2222-2222-2222-222222222222',
    amountArs: 1500,
    etaMinutes: 15,
    message: 'Estoy cerca, llego en 15 min',
  };

  describe('submitOfferAction', () => {
    it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await submitOfferAction(validSubmitInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHENTICATED');
      }
    });

    it('rechaza si el rol no es courier con UNAUTHORIZED_ACTOR', async () => {
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
            data: { user: validCourierUser },
            error: null,
          }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await submitOfferAction(validSubmitInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHORIZED_ACTOR');
      }
    });

    it('rechaza datos inválidos con VALIDATION_ERROR', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'courier' },
              error: null,
            }),
          };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validCourierUser },
            error: null,
          }),
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await submitOfferAction({
        ...validSubmitInput,
        amountArs: -500, // Inválido
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });

    it('DoD: una oferta bajo el piso muestra el error del servidor (OFFER_BELOW_MINIMUM)', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'courier' },
              error: null,
            }),
          };
        }
        return {};
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validCourierUser },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      vi.mocked(offersRpc.submitOfferRpc).mockResolvedValue({
        ok: false,
        code: 'OFFER_BELOW_MINIMUM',
      });

      const result = await submitOfferAction({
        ...validSubmitInput,
        amountArs: 800, // Menor al piso de $ 1.000
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('OFFER_BELOW_MINIMUM');
      }
    });

    it('propaga error del RPC si el repartidor no está disponible (COURIER_UNAVAILABLE)', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'courier' },
              error: null,
            }),
          };
        }
        return {};
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validCourierUser },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      vi.mocked(offersRpc.submitOfferRpc).mockResolvedValue({
        ok: false,
        code: 'COURIER_UNAVAILABLE',
      });

      const result = await submitOfferAction(validSubmitInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('COURIER_UNAVAILABLE');
      }
    });

    it('envía oferta exitosamente y retorna ok con datos de la oferta creada', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'courier' },
              error: null,
            }),
          };
        }
        return {};
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validCourierUser },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const mockOfferOutput = {
        offerId: '33333333-3333-3333-3333-333333333333',
        requestId: validSubmitInput.requestId,
        status: 'pending' as const,
        amountArs: 1500,
        createdAt: '2026-09-23T18:00:00.000Z',
      };

      vi.mocked(offersRpc.submitOfferRpc).mockResolvedValue({
        ok: true,
        data: mockOfferOutput,
      });

      const result = await submitOfferAction(validSubmitInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.offerId).toBe(mockOfferOutput.offerId);
        expect(result.data.status).toBe('pending');
      }
    });
  });

  describe('withdrawOfferAction', () => {
    const validWithdrawInput = {
      offerId: '33333333-3333-3333-3333-333333333333',
    };

    it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await withdrawOfferAction(validWithdrawInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHENTICATED');
      }
    });

    it('rechaza si la oferta ya no está pendiente con OFFER_NOT_PENDING', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'courier' },
              error: null,
            }),
          };
        }
        return {};
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validCourierUser },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      vi.mocked(offersRpc.withdrawOfferRpc).mockResolvedValue({
        ok: false,
        code: 'OFFER_NOT_PENDING',
      });

      const result = await withdrawOfferAction(validWithdrawInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('OFFER_NOT_PENDING');
      }
    });

    it('retira oferta exitosamente con ok', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'courier' },
              error: null,
            }),
          };
        }
        return {};
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validCourierUser },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      vi.mocked(offersRpc.withdrawOfferRpc).mockResolvedValue({
        ok: true,
        data: {
          offerId: validWithdrawInput.offerId,
          status: 'withdrawn',
          decidedAt: '2026-09-23T18:05:00.000Z',
        },
      });

      const result = await withdrawOfferAction(validWithdrawInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe('withdrawn');
      }
    });
  });
});
