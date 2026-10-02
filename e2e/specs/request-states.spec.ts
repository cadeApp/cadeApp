import { test, expect } from '@playwright/test';
import {
  transitionRequest,
  getEffectiveRequestStatus,
  canTransitionRequest,
  transitionOffer,
  isRequestExpired,
  type RequestActor,
} from '@/domain/states';
import {
  cancelRequestInputSchema,
  republishRequestInputSchema,
  reportNoShowInputSchema,
  courierCancelMatchInputSchema,
  markPickedUpInputSchema,
  markDeliveredInputSchema,
  publishRequestInputSchema,
  acceptOfferInputSchema,
} from '@/domain/rpc-contracts';

/**
 * T-304: E2E y matriz de estados (§5.1 de master-plan.md)
 *
 * Flujos y transiciones cubiertos:
 * 1. draft -> published (merchant dueño, suscripción/piloto activa, cálculo de expires_at)
 * 2. published -> matched (merchant dueño, aceptación atómica, una accepted y resto rejected)
 * 3. published -> cancelled (merchant dueño sin penalidad, ofertas pending pasan a expired)
 * 4. published -> expired (sistema, now > expires_at, expiración perezosa)
 * 5. matched -> in_transit (courier asignado marca retirado)
 * 6a. matched -> published (republicar: comercio reporta 'no llegó' con motivo no_show)
 * 6b. matched -> published (republicar: courier cancela match con motivo obligatorio)
 * 7. matched -> cancelled (comercio dueño cancela con motivo obligatorio)
 * 8. in_transit -> delivered (courier asignado confirma entrega, ventana 24 h para reporte)
 * 9. in_transit -> cancelled (admin cancela por incidente con motivo)
 * 10. DoD Invariante crítica: falla si se permite cancelar después de entregado (ni merchant,
 *     ni courier, ni admin pueden cancelar cuando el pedido está delivered).
 */

const SAMPLE_NOW = new Date('2026-10-01T20:00:00.000Z');
const SAMPLE_FUTURE_EXPIRES = new Date('2026-10-01T20:45:00.000Z');
const SAMPLE_PAST_EXPIRES = new Date('2026-10-01T19:50:00.000Z');

test.describe('T-304 — Matriz de estados y transiciones (§5.1)', () => {
  // ---------------------------------------------------------------------------
  // Fila 1: draft -> published
  // ---------------------------------------------------------------------------
  test('Fila 1 (§5.1): draft -> published (merchant dueño con suscripción activa/piloto)', async () => {
    // 1. Éxito: comercio dueño en piloto activo
    const validTransition = transitionRequest({
      from: 'draft',
      to: 'published',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
      subscriptionStatus: 'pilot',
      pilotActive: true,
    });
    expect(validTransition.ok).toBe(true);
    if (validTransition.ok) {
      expect(validTransition.data.status).toBe('published');
      expect(validTransition.data.offerSideEffect).toBe('none');
    }

    // 2. Rechazo si el actor no es el comercio dueño
    const unauthorizedCourier = transitionRequest({
      from: 'draft',
      to: 'published',
      actor: 'courier',
      now: SAMPLE_NOW,
      isOwnerMerchant: false,
      subscriptionStatus: 'pilot',
      pilotActive: true,
    });
    expect(unauthorizedCourier.ok).toBe(false);
    if (!unauthorizedCourier.ok) {
      expect(unauthorizedCourier.code).toBe('UNAUTHORIZED_ACTOR');
    }

    // 3. Rechazo si la suscripción está vencida o cancelada
    const inactiveSub = transitionRequest({
      from: 'draft',
      to: 'published',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
      subscriptionStatus: 'expired',
      pilotActive: false,
    });
    expect(inactiveSub.ok).toBe(false);
    if (!inactiveSub.ok) {
      expect(inactiveSub.code).toBe('SUBSCRIPTION_INACTIVE');
    }

    // Validación de contrato de entrada RPC
    const validRpcInput = publishRequestInputSchema.safeParse({
      requestId: 'a0000000-0000-4000-8000-000000000001',
    });
    expect(validRpcInput.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Fila 2: published -> matched
  // ---------------------------------------------------------------------------
  test('Fila 2 (§5.1): published -> matched (merchant dueño acepta oferta atómicamente)', async () => {
    // 1. Éxito: comercio dueño acepta oferta mientras está publicada y no vencida
    const validTransition = transitionRequest({
      from: 'published',
      to: 'matched',
      actor: 'merchant',
      now: SAMPLE_NOW,
      expiresAt: SAMPLE_FUTURE_EXPIRES,
      isOwnerMerchant: true,
    });
    expect(validTransition.ok).toBe(true);
    if (validTransition.ok) {
      expect(validTransition.data.status).toBe('matched');
      expect(validTransition.data.offerSideEffect).toBe('accept_one_reject_others');
    }

    // Efecto colateral atómico de ofertas
    expect(transitionOffer('pending', 'accepted', 'merchant').ok).toBe(true);
    expect(transitionOffer('pending', 'rejected', 'system').ok).toBe(true);

    // 2. Rechazo si el actor no es el dueño
    const unauthorizedAccept = transitionRequest({
      from: 'published',
      to: 'matched',
      actor: 'courier',
      now: SAMPLE_NOW,
      expiresAt: SAMPLE_FUTURE_EXPIRES,
      isOwnerMerchant: false,
    });
    expect(unauthorizedAccept.ok).toBe(false);
    if (!unauthorizedAccept.ok) {
      expect(unauthorizedAccept.code).toBe('UNAUTHORIZED_ACTOR');
    }

    // Contrato RPC accept_offer
    const validAcceptRpc = acceptOfferInputSchema.safeParse({
      offerId: 'b0000000-0000-4000-8000-000000000001',
    });
    expect(validAcceptRpc.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Fila 3: published -> cancelled
  // ---------------------------------------------------------------------------
  test('Fila 3 (§5.1): published -> cancelled (merchant dueño cancela sin penalidad)', async () => {
    // 1. Éxito: comercio dueño cancela antes de aceptar oferta
    const validTransition = transitionRequest({
      from: 'published',
      to: 'cancelled',
      actor: 'merchant',
      now: SAMPLE_NOW,
      expiresAt: SAMPLE_FUTURE_EXPIRES,
      isOwnerMerchant: true,
    });
    expect(validTransition.ok).toBe(true);
    if (validTransition.ok) {
      expect(validTransition.data.status).toBe('cancelled');
      // Las ofertas pendientes expiran
      expect(validTransition.data.offerSideEffect).toBe('expire_all_pending');
    }

    // Oferta pending pasa a expired al cancelarse la solicitud publicada
    expect(transitionOffer('pending', 'expired', 'merchant').ok).toBe(true);

    // 2. Courier no puede cancelar una solicitud publicada
    const courierCancel = transitionRequest({
      from: 'published',
      to: 'cancelled',
      actor: 'courier',
      now: SAMPLE_NOW,
      expiresAt: SAMPLE_FUTURE_EXPIRES,
    });
    expect(courierCancel.ok).toBe(false);
    if (!courierCancel.ok) {
      expect(courierCancel.code).toBe('UNAUTHORIZED_ACTOR');
    }
  });

  // ---------------------------------------------------------------------------
  // Fila 4: published -> expired
  // ---------------------------------------------------------------------------
  test('Fila 4 (§5.1): published -> expired (expiración perezosa cuando now > expires_at)', async () => {
    // 1. Detección de expiración perezosa
    expect(isRequestExpired('published', SAMPLE_PAST_EXPIRES, SAMPLE_NOW)).toBe(true);
    expect(getEffectiveRequestStatus('published', SAMPLE_PAST_EXPIRES, SAMPLE_NOW)).toBe('expired');

    // Solicitud aún vigente no debe ser tratada como expirada
    expect(isRequestExpired('published', SAMPLE_FUTURE_EXPIRES, SAMPLE_NOW)).toBe(false);
    expect(getEffectiveRequestStatus('published', SAMPLE_FUTURE_EXPIRES, SAMPLE_NOW)).toBe('published');

    // 2. Transición explícita por sistema
    const validExpire = transitionRequest({
      from: 'published',
      to: 'expired',
      actor: 'system',
      now: SAMPLE_NOW,
      expiresAt: SAMPLE_PAST_EXPIRES,
    });
    expect(validExpire.ok).toBe(true);
    if (validExpire.ok) {
      expect(validExpire.data.status).toBe('expired');
      expect(validExpire.data.offerSideEffect).toBe('expire_all_pending');
    }

    // 3. No expira si todavía no venció
    const prematureExpire = transitionRequest({
      from: 'published',
      to: 'expired',
      actor: 'system',
      now: SAMPLE_NOW,
      expiresAt: SAMPLE_FUTURE_EXPIRES,
    });
    expect(prematureExpire.ok).toBe(false);
    if (!prematureExpire.ok) {
      expect(prematureExpire.code).toBe('INVALID_STATE_TRANSITION');
    }

    // 4. Intentar transicionar una solicitud expirada como si estuviera publicada debe fallar
    const actionOnExpired = transitionRequest({
      from: 'published',
      to: 'matched',
      actor: 'merchant',
      now: SAMPLE_NOW,
      expiresAt: SAMPLE_PAST_EXPIRES,
      isOwnerMerchant: true,
    });
    expect(actionOnExpired.ok).toBe(false);
    if (!actionOnExpired.ok) {
      expect(actionOnExpired.code).toBe('REQUEST_EXPIRED');
    }
  });

  // ---------------------------------------------------------------------------
  // Fila 5: matched -> in_transit
  // ---------------------------------------------------------------------------
  test('Fila 5 (§5.1): matched -> in_transit (courier asignado marca retirado)', async () => {
    // 1. Éxito: repartidor asignado marca pedido retirado
    const validTransition = transitionRequest({
      from: 'matched',
      to: 'in_transit',
      actor: 'courier',
      now: SAMPLE_NOW,
      isAssignedCourier: true,
    });
    expect(validTransition.ok).toBe(true);
    if (validTransition.ok) {
      expect(validTransition.data.status).toBe('in_transit');
      expect(validTransition.data.offerSideEffect).toBe('none');
    }

    // 2. Rechazo si el courier no es el asignado
    const unassignedCourier = transitionRequest({
      from: 'matched',
      to: 'in_transit',
      actor: 'courier',
      now: SAMPLE_NOW,
      isAssignedCourier: false,
    });
    expect(unassignedCourier.ok).toBe(false);
    if (!unassignedCourier.ok) {
      expect(unassignedCourier.code).toBe('UNAUTHORIZED_ACTOR');
    }

    // 3. Comercio no puede marcar retirado
    const merchantPickup = transitionRequest({
      from: 'matched',
      to: 'in_transit',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
    });
    expect(merchantPickup.ok).toBe(false);

    // Contrato RPC mark_picked_up
    const validPickupRpc = markPickedUpInputSchema.safeParse({
      requestId: 'a0000000-0000-4000-8000-000000000001',
    });
    expect(validPickupRpc.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Fila 6a: matched -> published (republicar por comercio: el repartidor no llegó)
  // ---------------------------------------------------------------------------
  test('Fila 6a (§5.1): matched -> published (republicar: comercio reporta no llegó)', async () => {
    // 1. Éxito: comercio dueño reporta no_show
    const validNoShow = transitionRequest({
      from: 'matched',
      to: 'published',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
      reason: 'no_show',
    });
    expect(validNoShow.ok).toBe(true);
    if (validNoShow.ok) {
      expect(validNoShow.data.status).toBe('published');
      // La oferta aceptada pasa a cancelled
      expect(validNoShow.data.offerSideEffect).toBe('cancel_accepted');
    }

    // Oferta aceptada pasa a cancelled
    expect(transitionOffer('accepted', 'cancelled', 'merchant').ok).toBe(true);

    // 2. Falla si falta el motivo
    const missingReason = transitionRequest({
      from: 'matched',
      to: 'published',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
      reason: '',
    });
    expect(missingReason.ok).toBe(false);
    if (!missingReason.ok) {
      expect(missingReason.code).toBe('REASON_REQUIRED');
    }

    // Contrato RPC report_no_show
    const validNoShowRpc = reportNoShowInputSchema.safeParse({
      requestId: 'a0000000-0000-4000-8000-000000000001',
      republish: true,
    });
    expect(validNoShowRpc.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Fila 6b: matched -> published (republicar por courier: cancela match)
  // ---------------------------------------------------------------------------
  test('Fila 6b (§5.1): matched -> published (republicar: courier cancela match con motivo)', async () => {
    // 1. Éxito: repartidor asignado cancela match con motivo obligatorio
    const validCourierCancel = transitionRequest({
      from: 'matched',
      to: 'published',
      actor: 'courier',
      now: SAMPLE_NOW,
      isAssignedCourier: true,
      reason: 'Se pinchó la rueda de la moto en camino al local',
    });
    expect(validCourierCancel.ok).toBe(true);
    if (validCourierCancel.ok) {
      expect(validCourierCancel.data.status).toBe('published');
      expect(validCourierCancel.data.offerSideEffect).toBe('cancel_accepted');
    }

    // 2. Rechazo si el motivo está vacío
    const emptyReason = transitionRequest({
      from: 'matched',
      to: 'published',
      actor: 'courier',
      now: SAMPLE_NOW,
      isAssignedCourier: true,
      reason: '   ',
    });
    expect(emptyReason.ok).toBe(false);
    if (!emptyReason.ok) {
      expect(emptyReason.code).toBe('REASON_REQUIRED');
    }

    // 3. Rechazo si el courier no es el asignado
    const nonAssigned = transitionRequest({
      from: 'matched',
      to: 'published',
      actor: 'courier',
      now: SAMPLE_NOW,
      isAssignedCourier: false,
      reason: 'Motivo cualquiera',
    });
    expect(nonAssigned.ok).toBe(false);
    if (!nonAssigned.ok) {
      expect(nonAssigned.code).toBe('UNAUTHORIZED_ACTOR');
    }

    // Contrato RPC courier_cancel_match
    const validCourierCancelRpc = courierCancelMatchInputSchema.safeParse({
      requestId: 'a0000000-0000-4000-8000-000000000001',
      reason: 'Demora imprevista',
    });
    expect(validCourierCancelRpc.success).toBe(true);

    const invalidEmptyCourierCancelRpc = courierCancelMatchInputSchema.safeParse({
      requestId: 'a0000000-0000-4000-8000-000000000001',
      reason: '  ',
    });
    expect(invalidEmptyCourierCancelRpc.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Fila 7: matched -> cancelled
  // ---------------------------------------------------------------------------
  test('Fila 7 (§5.1): matched -> cancelled (comercio dueño cancela con motivo obligatorio)', async () => {
    // 1. Éxito: comercio dueño cancela match informando motivo
    const validCancel = transitionRequest({
      from: 'matched',
      to: 'cancelled',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
      reason: 'El cliente final canceló el pedido por demora del local',
    });
    expect(validCancel.ok).toBe(true);
    if (validCancel.ok) {
      expect(validCancel.data.status).toBe('cancelled');
      expect(validCancel.data.offerSideEffect).toBe('cancel_accepted');
    }

    // 2. Falla si falta el motivo
    const missingReason = transitionRequest({
      from: 'matched',
      to: 'cancelled',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
      reason: '',
    });
    expect(missingReason.ok).toBe(false);
    if (!missingReason.ok) {
      expect(missingReason.code).toBe('REASON_REQUIRED');
    }

    // Contrato RPC cancel_request
    const validCancelRpc = cancelRequestInputSchema.safeParse({
      requestId: 'a0000000-0000-4000-8000-000000000001',
      reason: 'Motivo válido',
    });
    expect(validCancelRpc.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Fila 8: in_transit -> delivered
  // ---------------------------------------------------------------------------
  test('Fila 8 (§5.1): in_transit -> delivered (courier asignado confirma entrega)', async () => {
    // 1. Éxito: repartidor asignado confirma entrega
    const validDelivery = transitionRequest({
      from: 'in_transit',
      to: 'delivered',
      actor: 'courier',
      now: SAMPLE_NOW,
      isAssignedCourier: true,
    });
    expect(validDelivery.ok).toBe(true);
    if (validDelivery.ok) {
      expect(validDelivery.data.status).toBe('delivered');
      expect(validDelivery.data.offerSideEffect).toBe('none');
    }

    // 2. Rechazo si el courier no es el asignado
    const unauthorizedCourier = transitionRequest({
      from: 'in_transit',
      to: 'delivered',
      actor: 'courier',
      now: SAMPLE_NOW,
      isAssignedCourier: false,
    });
    expect(unauthorizedCourier.ok).toBe(false);
    if (!unauthorizedCourier.ok) {
      expect(unauthorizedCourier.code).toBe('UNAUTHORIZED_ACTOR');
    }

    // 3. Comercio no puede marcar como entregado
    const merchantDelivered = transitionRequest({
      from: 'in_transit',
      to: 'delivered',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
    });
    expect(merchantDelivered.ok).toBe(false);

    // Contrato RPC mark_delivered
    const validDeliveredRpc = markDeliveredInputSchema.safeParse({
      requestId: 'a0000000-0000-4000-8000-000000000001',
    });
    expect(validDeliveredRpc.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Fila 9: in_transit -> cancelled
  // ---------------------------------------------------------------------------
  test('Fila 9 (§5.1): in_transit -> cancelled (admin cancela por incidente con motivo)', async () => {
    // 1. Éxito: admin cancela un viaje en tránsito informando motivo de resolución
    const validAdminCancel = transitionRequest({
      from: 'in_transit',
      to: 'cancelled',
      actor: 'admin',
      now: SAMPLE_NOW,
      reason: 'Incidente de extravío resuelto por mediación administrativa',
    });
    expect(validAdminCancel.ok).toBe(true);
    if (validAdminCancel.ok) {
      expect(validAdminCancel.data.status).toBe('cancelled');
      expect(validAdminCancel.data.offerSideEffect).toBe('cancel_accepted');
    }

    // 2. Falla si falta el motivo
    const emptyReason = transitionRequest({
      from: 'in_transit',
      to: 'cancelled',
      actor: 'admin',
      now: SAMPLE_NOW,
      reason: '   ',
    });
    expect(emptyReason.ok).toBe(false);
    if (!emptyReason.ok) {
      expect(emptyReason.code).toBe('REASON_REQUIRED');
    }

    // 3. Ni comercio ni repartidor pueden cancelar un pedido ya retirado / en tránsito
    const merchantInTransitCancel = transitionRequest({
      from: 'in_transit',
      to: 'cancelled',
      actor: 'merchant',
      now: SAMPLE_NOW,
      isOwnerMerchant: true,
      reason: 'Quiero cancelar mientras viaja',
    });
    expect(merchantInTransitCancel.ok).toBe(false);
    if (!merchantInTransitCancel.ok) {
      expect(merchantInTransitCancel.code).toBe('UNAUTHORIZED_ACTOR');
    }

    const courierInTransitCancel = transitionRequest({
      from: 'in_transit',
      to: 'cancelled',
      actor: 'courier',
      now: SAMPLE_NOW,
      isAssignedCourier: true,
      reason: 'Cancelo en viaje',
    });
    expect(courierInTransitCancel.ok).toBe(false);
    if (!courierInTransitCancel.ok) {
      expect(courierInTransitCancel.code).toBe('UNAUTHORIZED_ACTOR');
    }
  });

  // ---------------------------------------------------------------------------
  // Invariante crítica del DoD: Falla si se permite cancelar después de entregado
  // ---------------------------------------------------------------------------
  test('DoD Invariante crítica: Falla si se permite cancelar después de entregado', async () => {
    // Demostración explícita de que NINGÚN actor puede cancelar un pedido entregado
    const actors: RequestActor[] = ['merchant', 'courier', 'admin', 'system'];

    for (const actor of actors) {
      // Intento de transición delivered -> cancelled
      const cancelAttempt = transitionRequest({
        from: 'delivered',
        to: 'cancelled',
        actor,
        now: SAMPLE_NOW,
        reason: 'Intento forzado de cancelación post-entrega',
        isOwnerMerchant: true,
        isAssignedCourier: true,
      });

      // Debe ser estrictamente rechazado con INVALID_STATE_TRANSITION
      expect(cancelAttempt.ok).toBe(false);
      if (!cancelAttempt.ok) {
        expect(cancelAttempt.code).toBe('INVALID_STATE_TRANSITION');
      }

      // La consulta canTransitionRequest debe devolver false
      expect(canTransitionRequest('delivered', 'cancelled', actor)).toBe(false);
    }

    // Tampoco se puede pasar de delivered a ningún otro estado anterior
    expect(canTransitionRequest('delivered', 'published', 'merchant')).toBe(false);
    expect(canTransitionRequest('delivered', 'matched', 'merchant')).toBe(false);
    expect(canTransitionRequest('delivered', 'in_transit', 'courier')).toBe(false);
  });
});
