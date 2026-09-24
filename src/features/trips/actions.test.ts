import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as requestsRpc from '@/server/rpc/requests';
import {
  markTripPickedUpAction,
  markTripDeliveredAction,
  courierCancelTripAction,
  merchantReportNoShowAction,
  merchantCancelTripAction,
  republishTripAction,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/rpc/requests', () => ({
  callRequestRpc: vi.fn(),
}));

describe('T-115 DoD: tests de actions por transición de viaje', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validCourierUser = { id: 'courier-uuid-1', email: 'courier@test.com' };
  const validMerchantUser = { id: 'merchant-uuid-1', email: 'merchant@test.com' };
  const validRequestId = '11111111-1111-1111-1111-111111111111';

  function mockSupabaseSession(user: { id: string; email: string } | null, role?: string) {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: role ? { role } : null,
            error: null,
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
  }

  describe('markTripPickedUpAction (repartidor marca retirado: matched -> in_transit)', () => {
    it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
      mockSupabaseSession(null);
      const res = await markTripPickedUpAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
    });

    it('rechaza si el rol no es courier con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      const res = await markTripPickedUpAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
    });

    it('rechaza input inválido con VALIDATION_ERROR', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      const res = await markTripPickedUpAction({ requestId: 'not-a-uuid' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('VALIDATION_ERROR');
    });

    it('retorna error del dominio si la RPC falla', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });

      const res = await markTripPickedUpAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('ejecuta exitosamente mark_picked_up y retorna el resultado', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: true,
        data: {
          requestId: validRequestId,
          status: 'in_transit',
          pickedUpAt: '2026-09-24T10:00:00.000Z',
        },
      });

      const res = await markTripPickedUpAction({ requestId: validRequestId });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe('in_transit');
      }
    });
  });

  describe('markTripDeliveredAction (repartidor marca entregado: in_transit -> delivered)', () => {
    it('rechaza si no es courier con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      const res = await markTripDeliveredAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
    });

    it('ejecuta exitosamente mark_delivered y retorna delivered', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: true,
        data: {
          requestId: validRequestId,
          status: 'delivered',
          deliveredAt: '2026-09-24T10:30:00.000Z',
        },
      });

      const res = await markTripDeliveredAction({ requestId: validRequestId });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe('delivered');
      }
    });
  });

  describe('courierCancelTripAction (repartidor cancela match: matched -> published)', () => {
    it('rechaza si falta el motivo de cancelación con VALIDATION_ERROR', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      const res = await courierCancelTripAction({
        requestId: validRequestId,
        reason: '   ',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('VALIDATION_ERROR');
    });

    it('ejecuta exitosamente courier_cancel_match con motivo válido', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: true,
        data: {
          requestId: validRequestId,
          status: 'published',
          cancelledOfferId: '22222222-2222-2222-2222-222222222222',
          expiresAt: '2026-09-24T11:00:00.000Z',
        },
      });

      const res = await courierCancelTripAction({
        requestId: validRequestId,
        reason: 'Problema con la moto',
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe('published');
      }
    });
  });

  describe('merchantReportNoShowAction (comercio reporta no llegó)', () => {
    it('rechaza si el rol no es merchant con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      const res = await merchantReportNoShowAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
    });

    it('ejecuta report_no_show con republish por defecto', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: true,
        data: {
          requestId: validRequestId,
          status: 'published',
          cancelledOfferId: '22222222-2222-2222-2222-222222222222',
          expiresAt: '2026-09-24T11:00:00.000Z',
        },
      });

      const res = await merchantReportNoShowAction({
        requestId: validRequestId,
        republish: true,
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe('published');
      }
    });
  });

  describe('merchantCancelTripAction (comercio cancela viaje con motivo)', () => {
    it('rechaza si falta el motivo con VALIDATION_ERROR', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      const res = await merchantCancelTripAction({
        requestId: validRequestId,
        reason: '',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('VALIDATION_ERROR');
    });

    it('ejecuta cancel_request con motivo', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: true,
        data: {
          requestId: validRequestId,
          status: 'cancelled',
          cancelledAt: '2026-09-24T10:00:00.000Z',
        },
      });

      const res = await merchantCancelTripAction({
        requestId: validRequestId,
        reason: 'Cliente canceló el pedido',
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe('cancelled');
      }
    });
  });

  describe('republishTripAction (comercio republica solicitud)', () => {
    it('ejecuta republish_request', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: true,
        data: {
          requestId: validRequestId,
          status: 'published',
          publishedAt: '2026-09-24T10:00:00.000Z',
          expiresAt: '2026-09-24T11:00:00.000Z',
        },
      });

      const res = await republishTripAction({
        requestId: validRequestId,
        reason: 'Reintentando conseguir repartidor',
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe('published');
      }
    });
  });
});
