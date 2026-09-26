import { describe, expect, it, vi, beforeEach } from 'vitest';
import { revalidatePath } from 'next/cache';
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

  let currentMockClient: unknown;

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

    currentMockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: mockFrom,
    };

    vi.mocked(serverSupabase.createClient).mockResolvedValue(
      currentMockClient as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
    );
  }

  // =========================================================================
  // H02: Matriz completa de 12 celdas de sesión y rol (6 actions × 2)
  // =========================================================================
  describe('H02: Matriz exhaustiva de autenticación y autorización (12 celdas)', () => {
    it('markTripPickedUpAction: rechaza sin sesión con UNAUTHENTICATED', async () => {
      mockSupabaseSession(null);
      const res = await markTripPickedUpAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('markTripPickedUpAction: rechaza rol merchant con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      const res = await markTripPickedUpAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('markTripDeliveredAction: rechaza sin sesión con UNAUTHENTICATED', async () => {
      mockSupabaseSession(null);
      const res = await markTripDeliveredAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('markTripDeliveredAction: rechaza rol merchant con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      const res = await markTripDeliveredAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('courierCancelTripAction: rechaza sin sesión con UNAUTHENTICATED', async () => {
      mockSupabaseSession(null);
      const res = await courierCancelTripAction({ requestId: validRequestId, reason: 'Problema mecánico' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('courierCancelTripAction: rechaza rol merchant con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      const res = await courierCancelTripAction({ requestId: validRequestId, reason: 'Problema mecánico' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('merchantReportNoShowAction: rechaza sin sesión con UNAUTHENTICATED', async () => {
      mockSupabaseSession(null);
      const res = await merchantReportNoShowAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('merchantReportNoShowAction: rechaza rol courier con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      const res = await merchantReportNoShowAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('merchantCancelTripAction: rechaza sin sesión con UNAUTHENTICATED', async () => {
      mockSupabaseSession(null);
      const res = await merchantCancelTripAction({ requestId: validRequestId, reason: 'Ya no hace falta' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('merchantCancelTripAction: rechaza rol courier con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      const res = await merchantCancelTripAction({ requestId: validRequestId, reason: 'Ya no hace falta' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('republishTripAction: rechaza sin sesión con UNAUTHENTICATED', async () => {
      mockSupabaseSession(null);
      const res = await republishTripAction({ requestId: validRequestId, reason: 'Reintentar' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });

    it('republishTripAction: rechaza rol courier con UNAUTHORIZED_ACTOR', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      const res = await republishTripAction({ requestId: validRequestId, reason: 'Reintentar' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(0);
    });
  });

  // =========================================================================
  // H08: Propagación de INVALID_STATE_TRANSITION en las 6 actions
  // =========================================================================
  describe('H08: Propagación de INVALID_STATE_TRANSITION en todas las acciones', () => {
    it('markTripPickedUpAction: propaga INVALID_STATE_TRANSITION', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
      const res = await markTripPickedUpAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('markTripDeliveredAction: propaga INVALID_STATE_TRANSITION', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
      const res = await markTripDeliveredAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('courierCancelTripAction: propaga INVALID_STATE_TRANSITION', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
      const res = await courierCancelTripAction({ requestId: validRequestId, reason: 'Problema mecánico' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('merchantReportNoShowAction: propaga INVALID_STATE_TRANSITION', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
      const res = await merchantReportNoShowAction({ requestId: validRequestId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('merchantCancelTripAction: propaga INVALID_STATE_TRANSITION', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
      const res = await merchantCancelTripAction({ requestId: validRequestId, reason: 'Ya no hace falta' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('republishTripAction: propaga INVALID_STATE_TRANSITION', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
      const res = await republishTripAction({ requestId: validRequestId, reason: 'Reintentar' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('INVALID_STATE_TRANSITION');
    });
  });

  // =========================================================================
  // Happy paths: H01 (exact RPC + input), H03 (default no-show), H11 (revalidate)
  // =========================================================================
  describe('Happy paths con aserciones exactas de RPC e invalidación (H01, H03, H11)', () => {
    it('markTripPickedUpAction: invoca mark_picked_up exactamente 1 vez con sus args e invalida caché', async () => {
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
      if (res.ok) expect(res.data.status).toBe('in_transit');

      // H01: Aserciones exactas sobre callRequestRpc
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledWith(
        currentMockClient,
        'mark_picked_up',
        { requestId: validRequestId }
      );

      // H11: Revalidación de caché
      expect(revalidatePath).toHaveBeenCalledWith(`/trips/${validRequestId}`);
      expect(revalidatePath).toHaveBeenCalledWith('/courier/feed');
    });

    it('markTripDeliveredAction: invoca mark_delivered exactamente 1 vez con sus args e invalida caché', async () => {
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
      if (res.ok) expect(res.data.status).toBe('delivered');

      // H01: Aserción exacta
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledWith(
        currentMockClient,
        'mark_delivered',
        { requestId: validRequestId }
      );

      // H11: Revalidación
      expect(revalidatePath).toHaveBeenCalledWith(`/trips/${validRequestId}`);
      expect(revalidatePath).toHaveBeenCalledWith('/courier/feed');
    });

    it('courierCancelTripAction: invoca courier_cancel_match exactamente 1 vez con motivo e invalida caché', async () => {
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
        reason: 'Problema mecánico en la moto',
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.status).toBe('published');

      // H01: Aserción exacta
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledWith(
        currentMockClient,
        'courier_cancel_match',
        { requestId: validRequestId, reason: 'Problema mecánico en la moto' }
      );

      // H11: Revalidación
      expect(revalidatePath).toHaveBeenCalledWith(`/trips/${validRequestId}`);
      expect(revalidatePath).toHaveBeenCalledWith('/courier/feed');
    });

    it('H03: merchantReportNoShowAction con republish OMITIDO invoca report_no_show con republish: true por defecto', async () => {
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

      // Se omite explícitamente el campo republish
      const res = await merchantReportNoShowAction({
        requestId: validRequestId,
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.status).toBe('published');

      // H01 y H03: Aserción exacta de argumentos con default a true
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledWith(
        currentMockClient,
        'report_no_show',
        { requestId: validRequestId, republish: true }
      );

      // H11: Revalidación
      expect(revalidatePath).toHaveBeenCalledWith(`/trips/${validRequestId}`);
      expect(revalidatePath).toHaveBeenCalledWith('/merchant/requests');
    });

    it('merchantCancelTripAction: invoca cancel_request exactamente 1 vez con motivo e invalida caché', async () => {
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
        reason: 'Cliente canceló el pedido por demora',
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.status).toBe('cancelled');

      // H01: Aserción exacta
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledWith(
        currentMockClient,
        'cancel_request',
        { requestId: validRequestId, reason: 'Cliente canceló el pedido por demora' }
      );

      // H11: Revalidación
      expect(revalidatePath).toHaveBeenCalledWith(`/trips/${validRequestId}`);
      expect(revalidatePath).toHaveBeenCalledWith('/merchant/requests');
    });

    it('republishTripAction: invoca republish_request exactamente 1 vez con motivo e invalida caché', async () => {
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
        reason: 'Reintentando conseguir repartidor disponible',
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.status).toBe('published');

      // H01: Aserción exacta
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledWith(
        currentMockClient,
        'republish_request',
        { requestId: validRequestId, reason: 'Reintentando conseguir repartidor disponible' }
      );

      // H11: Revalidación
      expect(revalidatePath).toHaveBeenCalledWith(`/trips/${validRequestId}`);
      expect(revalidatePath).toHaveBeenCalledWith('/merchant/requests');
    });
  });

  // =========================================================================
  // Validación de inputs
  // =========================================================================
  describe('Validación de esquemas Zod en actions', () => {
    it('rechaza requestId inválido con VALIDATION_ERROR', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      const res = await markTripPickedUpAction({ requestId: 'not-a-uuid' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('VALIDATION_ERROR');
    });

    it('courierCancelTripAction: rechaza motivo vacío con VALIDATION_ERROR', async () => {
      mockSupabaseSession(validCourierUser, 'courier');
      const res = await courierCancelTripAction({
        requestId: validRequestId,
        reason: '   ',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('VALIDATION_ERROR');
    });

    it('merchantCancelTripAction: rechaza motivo vacío con VALIDATION_ERROR', async () => {
      mockSupabaseSession(validMerchantUser, 'merchant');
      const res = await merchantCancelTripAction({
        requestId: validRequestId,
        reason: '',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('VALIDATION_ERROR');
    });
  });
});
