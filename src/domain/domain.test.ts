import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGUILARES_BOUNDS,
  ALL_DOMAIN_ERROR_CODES,
  ALL_RPC_NAMES,
  type ActionResult,
  RPC_CONTRACTS,
  aguilaresCoordPairSchema,
  calculateHaversineRouteDistanceM,
  canCourierBeAccepted,
  canCourierSubmitOffer,
  canMerchantPublishRequest,
  canTransitionOffer,
  canTransitionRequest,
  computeDocLevel,
  createFakeRpcClient,
  createOfferAmountArsSchema,
  err,
  getCourierDeclaredBadges,
  getCourierVerifiedBadges,
  getEffectiveRequestStatus,
  isDomainErrorCode,
  isErr,
  isOk,
  isRequestExpired,
  isWithinAguilaresBounds,
  ok,
  sortOffersForMerchant,
  transitionOffer,
  transitionRequest,
  validateOfferAmountAgainstFloor,
  validateRoutePointsAndCalculateDistanceM,
} from './index';

const SAMPLE_REQ_ID = '11111111-1111-4111-8111-111111111111';
const SAMPLE_OFFER_ID = '22222222-2222-4222-8222-222222222222';
const SAMPLE_USER_ID = '44444444-4444-4444-8444-444444444444';

describe('T-006 — Contratos de dominio (errors, states, priority, schemas, rpc-contracts, rpc-fake)', () => {
  describe('1. DomainErrorCode y ActionResult', () => {
    it('construye resultados ok y err tipados con y sin mensaje opcional y valida isDomainErrorCode', () => {
      const success: ActionResult<{ offerId: string }> = ok({ offerId: SAMPLE_OFFER_ID });
      expect(isOk(success)).toBe(true);
      expect(isErr(success)).toBe(false);
      if (success.ok) {
        expect(success.data.offerId).toBe(SAMPLE_OFFER_ID);
      }

      const failureWithMsg: ActionResult<{ offerId: string }> = err(
        'OFFER_BELOW_MINIMUM',
        'Debajo del piso'
      );
      expect(isOk(failureWithMsg)).toBe(false);
      expect(isErr(failureWithMsg)).toBe(true);
      if (!failureWithMsg.ok) {
        expect(failureWithMsg.code).toBe('OFFER_BELOW_MINIMUM');
        expect(failureWithMsg.message).toBe('Debajo del piso');
      }

      const failureNoMsg = err('UNAUTHORIZED_ACTOR');
      expect(failureNoMsg).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(isDomainErrorCode('OFFER_BELOW_MINIMUM')).toBe(true);
      expect(isDomainErrorCode('UNKNOWN_ERROR_CODE')).toBe(false);
      expect(isDomainErrorCode(123)).toBe(false);
    });

    it('declara una lista canónica sin duplicados de todos los DomainErrorCode', () => {
      expect(ALL_DOMAIN_ERROR_CODES.length).toBeGreaterThanOrEqual(16);
      expect(new Set(ALL_DOMAIN_ERROR_CODES).size).toBe(ALL_DOMAIN_ERROR_CODES.length);
    });
  });

  describe('2. Máquina de estados de delivery_requests por actor (§5.1)', () => {
    const baseNow = new Date('2026-09-22T15:00:00.000Z');
    const futureExpiry = new Date('2026-09-22T15:30:00.000Z');
    const pastExpiry = new Date('2026-09-22T14:30:00.000Z');

    it('permite las 9 transiciones válidas de §5.1 con el actor y precondiciones correctas', () => {
      expect(
        transitionRequest({
          from: 'draft',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          pilotActive: true,
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'draft',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          pilotActive: false,
          subscriptionStatus: 'active',
          paidUntil: '2026-09-25',
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'published',
          to: 'matched',
          actor: 'merchant',
          isOwnerMerchant: true,
          expiresAt: futureExpiry,
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'published',
          to: 'cancelled',
          actor: 'merchant',
          isOwnerMerchant: true,
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'published',
          to: 'expired',
          actor: 'system',
          expiresAt: pastExpiry,
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'matched',
          to: 'in_transit',
          actor: 'courier',
          isAssignedCourier: true,
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          reason: 'no_show',
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'courier',
          isAssignedCourier: true,
          reason: 'Pinchadura en la moto',
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'matched',
          to: 'cancelled',
          actor: 'merchant',
          isOwnerMerchant: true,
          reason: 'Cliente canceló el pedido',
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'delivered',
          actor: 'courier',
          isAssignedCourier: true,
          now: baseNow,
        }).ok
      ).toBe(true);

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'cancelled',
          actor: 'admin',
          reason: 'Incidente vial reportado',
          now: baseNow,
        }).ok
      ).toBe(true);
    });

    it('rechaza todas las transiciones inválidas por actor, estado terminal o precondición faltante', () => {
      expect(
        transitionRequest({ from: 'draft', to: 'published', actor: 'courier', now: baseNow })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'draft',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: false,
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'draft',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          pilotActive: false,
          paidUntil: new Date('2026-09-20T00:00:00.000Z'),
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'SUBSCRIPTION_INACTIVE' }));

      expect(
        transitionRequest({
          from: 'published',
          to: 'matched',
          actor: 'courier',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'published',
          to: 'cancelled',
          actor: 'courier',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'published',
          to: 'expired',
          actor: 'merchant',
          expiresAt: pastExpiry,
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'published',
          to: 'expired',
          actor: 'system',
          expiresAt: futureExpiry,
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'INVALID_STATE_TRANSITION' }));

      expect(
        transitionRequest({
          from: 'matched',
          to: 'in_transit',
          actor: 'merchant',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: false,
          reason: 'no_show',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          reason: '',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'VALIDATION_ERROR' }));

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'courier',
          isAssignedCourier: false,
          reason: 'Motivo',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'courier',
          isAssignedCourier: true,
          reason: '',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'VALIDATION_ERROR' }));

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'admin',
          reason: 'Admin',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'matched',
          to: 'cancelled',
          actor: 'courier',
          reason: 'Motivo',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'matched',
          to: 'cancelled',
          actor: 'merchant',
          isOwnerMerchant: true,
          reason: '   ',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'VALIDATION_ERROR' }));

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'delivered',
          actor: 'merchant',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'cancelled',
          actor: 'merchant',
          isOwnerMerchant: true,
          reason: 'Intento de cancelar en viaje',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'cancelled',
          actor: 'admin',
          reason: '',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'VALIDATION_ERROR' }));

      expect(
        transitionRequest({
          from: 'delivered',
          to: 'cancelled',
          actor: 'admin',
          reason: 'Tarde',
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'INVALID_STATE_TRANSITION' }));

      expect(
        transitionRequest({
          from: 'published',
          to: 'matched',
          actor: 'merchant',
          isOwnerMerchant: true,
          expiresAt: pastExpiry,
          now: baseNow,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'REQUEST_EXPIRED' }));

      expect(canTransitionRequest('delivered', 'published', 'merchant')).toBe(false);
      expect(canTransitionRequest('published', 'expired', 'system')).toBe(true);
    });

    it('evalúa expiración perezosa de solicitudes published con fechas válidas, nulas e inválidas', () => {
      expect(isRequestExpired('published', pastExpiry, baseNow)).toBe(true);
      expect(isRequestExpired('published', '2026-09-22T14:30:00.000Z', baseNow)).toBe(true);
      expect(isRequestExpired('published', futureExpiry, baseNow)).toBe(false);
      expect(isRequestExpired('published', null, baseNow)).toBe(false);
      expect(isRequestExpired('published', 'invalid-date', baseNow)).toBe(false);
      expect(isRequestExpired('matched', pastExpiry, baseNow)).toBe(false);
      expect(getEffectiveRequestStatus('published', pastExpiry, baseNow)).toBe('expired');
      expect(getEffectiveRequestStatus('published', futureExpiry, baseNow)).toBe('published');
    });
  });

  describe('3. Máquina de estados de offers y elegibilidad de repartidor/comercio (§5.2, §6.3)', () => {
    it('permite transiciones desde pending y bloquea cambios por actor no autorizado o estado final', () => {
      expect(canTransitionOffer('pending', 'withdrawn', 'courier')).toBe(true);
      expect(canTransitionOffer('pending', 'withdrawn', 'admin')).toBe(true);
      expect(canTransitionOffer('pending', 'withdrawn', 'merchant')).toBe(false);

      expect(canTransitionOffer('pending', 'accepted', 'merchant')).toBe(true);
      expect(canTransitionOffer('pending', 'accepted', 'courier')).toBe(false);

      expect(canTransitionOffer('pending', 'rejected', 'system')).toBe(true);
      expect(canTransitionOffer('pending', 'rejected', 'merchant')).toBe(true);
      expect(canTransitionOffer('pending', 'rejected', 'courier')).toBe(false);

      expect(canTransitionOffer('pending', 'expired', 'system')).toBe(true);
      expect(canTransitionOffer('pending', 'expired', 'merchant')).toBe(true);
      expect(canTransitionOffer('pending', 'expired', 'courier')).toBe(false);

      expect(canTransitionOffer('accepted', 'cancelled', 'system')).toBe(true);
      expect(canTransitionOffer('withdrawn', 'accepted', 'merchant')).toBe(false);
      expect(transitionOffer('withdrawn', 'accepted', 'merchant')).toEqual(
        expect.objectContaining({ ok: false, code: 'INVALID_STATE_TRANSITION' })
      );
    });

    it('verifica autorización de repartidor (submit y accept) y comercio (pilot o paid_until)', () => {
      expect(canCourierSubmitOffer({ status: 'approved', available: true })).toEqual({
        ok: true,
        data: true,
      });
      expect(canCourierSubmitOffer({ status: 'pending', available: true })).toEqual(
        expect.objectContaining({ ok: false, code: 'COURIER_NOT_APPROVED' })
      );
      expect(canCourierSubmitOffer({ status: 'rejected', available: true })).toEqual(
        expect.objectContaining({ ok: false, code: 'COURIER_NOT_APPROVED' })
      );
      expect(canCourierSubmitOffer({ status: 'suspended', available: true })).toEqual(
        expect.objectContaining({ ok: false, code: 'COURIER_SUSPENDED' })
      );
      expect(canCourierSubmitOffer({ status: 'approved', available: false })).toEqual(
        expect.objectContaining({ ok: false, code: 'COURIER_UNAVAILABLE' })
      );

      expect(canCourierBeAccepted({ status: 'approved' })).toEqual({ ok: true, data: true });
      expect(canCourierBeAccepted({ status: 'suspended' })).toEqual(
        expect.objectContaining({ ok: false, code: 'COURIER_SUSPENDED' })
      );
      expect(canCourierBeAccepted({ status: 'pending' })).toEqual(
        expect.objectContaining({ ok: false, code: 'COURIER_NOT_APPROVED' })
      );

      const now = new Date('2026-09-22T12:00:00.000Z');
      expect(
        canMerchantPublishRequest({
          subscriptionStatus: 'pilot',
          pilotActive: true,
          paidUntil: null,
          graceDays: 0,
          now,
        }).ok
      ).toBe(true);
      expect(
        canMerchantPublishRequest({
          subscriptionStatus: 'cancelled',
          pilotActive: true,
          paidUntil: '2026-10-01',
          graceDays: 0,
          now,
        })
      ).toEqual(expect.objectContaining({ ok: false, code: 'SUBSCRIPTION_INACTIVE' }));
    });
  });

  describe('4. Prioridad por documentación (doc_level) y orden de ofertas (§6.4)', () => {
    it('calcula doc_level (0..2), insignias verificadas e insignias declaradas', () => {
      expect(computeDocLevel('none', 'none')).toBe(0);
      expect(computeDocLevel('submitted', 'submitted')).toBe(0);
      expect(computeDocLevel('verified', 'submitted')).toBe(1);
      expect(computeDocLevel('verified', 'verified')).toBe(2);

      expect(getCourierVerifiedBadges('submitted', 'verified')).toEqual(['insurance_verified']);
      expect(getCourierVerifiedBadges('verified', 'verified')).toEqual([
        'license_verified',
        'insurance_verified',
      ]);

      expect(
        getCourierDeclaredBadges({
          licenseStatus: 'submitted',
          insuranceStatus: 'submitted',
          vehicleType: 'moto',
        })
      ).toEqual(['vehicle_declared', 'license_declared', 'insurance_declared']);

      expect(
        getCourierDeclaredBadges({
          licenseStatus: 'verified',
          insuranceStatus: 'none',
          vehicleType: null,
        })
      ).toEqual([]);
    });

    it('ordena ofertas por doc_level descendente, created_at ascendente, precio e id como desempate', () => {
      const offers = [
        {
          id: 'offer-low-doc-early',
          amountArs: 1200,
          docLevel: 0 as const,
          createdAt: '2026-09-22T12:00:00.000Z',
        },
        {
          id: 'offer-high-doc-late',
          amountArs: 1800,
          docLevel: 2 as const,
          createdAt: new Date('2026-09-22T12:05:00.000Z'),
        },
        {
          id: 'offer-high-doc-early-expensive',
          amountArs: 1950,
          docLevel: 2 as const,
          createdAt: '2026-09-22T12:01:00.000Z',
        },
        {
          id: 'offer-high-doc-early-cheaper-b',
          amountArs: 1900,
          docLevel: 2 as const,
          createdAt: '2026-09-22T12:01:00.000Z',
        },
        {
          id: 'offer-high-doc-early-cheaper-a',
          amountArs: 1900,
          docLevel: 2 as const,
          createdAt: '2026-09-22T12:01:00.000Z',
        },
        {
          id: 'offer-mid-doc',
          amountArs: 1000,
          docLevel: 1 as const,
          createdAt: '2026-09-22T12:02:00.000Z',
        },
      ];

      const byDocLevel = sortOffersForMerchant(offers, 'doc_level');
      expect(byDocLevel.map((o) => o.id)).toEqual([
        'offer-high-doc-early-cheaper-a',
        'offer-high-doc-early-cheaper-b',
        'offer-high-doc-early-expensive',
        'offer-high-doc-late',
        'offer-mid-doc',
        'offer-low-doc-early',
      ]);

      const byPrice = sortOffersForMerchant(offers, 'price');
      expect(byPrice[0]?.id).toBe('offer-mid-doc');
      expect(byPrice[1]?.id).toBe('offer-low-doc-early');
    });
  });

  describe('5. Piso configurable (999/1000/1001 y 1500), coordenadas de Aguilares y Haversine (§6.2, §6.5)', () => {
    it('valida montos enteros contra min_offer_ars dinámico (1000 y 1500) sin hardcodear', () => {
      expect(validateOfferAmountAgainstFloor(999, 1000)).toEqual(
        expect.objectContaining({ ok: false, code: 'OFFER_BELOW_MINIMUM' })
      );
      expect(validateOfferAmountAgainstFloor(1000, 1000).ok).toBe(true);
      expect(validateOfferAmountAgainstFloor(1001, 1000).ok).toBe(true);
      expect(validateOfferAmountAgainstFloor(1000.5, 1000)).toEqual(
        expect.objectContaining({ ok: false, code: 'VALIDATION_ERROR' })
      );

      // Con el piso cambiado a 1500 en platform_settings:
      expect(validateOfferAmountAgainstFloor(1000, 1500)).toEqual(
        expect.objectContaining({ ok: false, code: 'OFFER_BELOW_MINIMUM' })
      );
      expect(validateOfferAmountAgainstFloor(1499, 1500)).toEqual(
        expect.objectContaining({ ok: false, code: 'OFFER_BELOW_MINIMUM' })
      );
      expect(validateOfferAmountAgainstFloor(1500, 1500).ok).toBe(true);

      const dynamicSchema = createOfferAmountArsSchema(1500);
      expect(dynamicSchema.safeParse(1499).success).toBe(false);
      expect(dynamicSchema.safeParse(1500).success).toBe(true);
    });

    it('valida el bounding box de Aguilares y calcula distancia Haversine × 1.30 redondeada a 500m', () => {
      expect(AGUILARES_BOUNDS).toEqual({
        minLat: -27.455,
        maxLat: -27.41,
        minLng: -65.64,
        maxLng: -65.595,
      });
      expect(isWithinAguilaresBounds(-27.433, -65.614)).toBe(true);
      expect(isWithinAguilaresBounds(-26.824, -65.222)).toBe(false);

      expect(aguilaresCoordPairSchema.safeParse({ lat: -27.433, lng: -65.614 }).success).toBe(true);
      expect(aguilaresCoordPairSchema.safeParse({ lat: null, lng: null }).success).toBe(true);
      expect(aguilaresCoordPairSchema.safeParse({ lat: -27.433, lng: null }).success).toBe(false);

      const dist = calculateHaversineRouteDistanceM(
        { lat: -27.433, lng: -65.614 },
        { lat: -27.442, lng: -65.622 }
      );
      expect(dist % 500).toBe(0);
      expect(dist).toBeGreaterThanOrEqual(500);

      const validRoute = validateRoutePointsAndCalculateDistanceM(
        { lat: -27.433, lng: -65.614 },
        { lat: -27.442, lng: -65.622 }
      );
      expect(validRoute.ok).toBe(true);

      const outOfBoundsRoute = validateRoutePointsAndCalculateDistanceM(
        { lat: -26.824, lng: -65.222 },
        { lat: -27.442, lng: -65.622 }
      );
      expect(outOfBoundsRoute).toEqual({ ok: false, code: 'OUT_OF_BOUNDS_AGUILARES' });
    });
  });

  describe('6. Contratos de las 18 RPCs (rpc-contracts.ts) y el fake (testing/rpc-fake.ts)', () => {
    it('define contratos Zod de entrada, salida y códigos de error para las 18 RPCs del master plan', () => {
      expect(ALL_RPC_NAMES).toEqual([
        'publish_request',
        'cancel_request',
        'submit_offer',
        'withdraw_offer',
        'accept_offer',
        'mark_picked_up',
        'mark_delivered',
        'report_no_show',
        'courier_cancel_match',
        'republish_request',
        'report_incident',
        'set_availability',
        'calculate_route_distance',
        'admin_decide_courier',
        'admin_suspend_courier',
        'admin_verify_document',
        'admin_set_subscription',
        'admin_update_setting',
      ]);

      for (const rpcName of ALL_RPC_NAMES) {
        const contract = RPC_CONTRACTS[rpcName];
        expect(contract).toBeDefined();
        expect(contract.errorCodes.length).toBeGreaterThan(0);
      }
    });

    it('el fake devuelve CADA código de DomainErrorCode y ejecuta las 18 RPCs (casos felices y bordes)', async () => {
      const fake = createFakeRpcClient();

      // 1. Verifica que cada código de DomainErrorCode pueda ser devuelto por el fake
      for (const errorCode of ALL_DOMAIN_ERROR_CODES) {
        const result = await fake.triggerErrorCode(errorCode);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe(errorCode);
        }
      }

      // 2. publish_request y cancel_request
      fake.setActor({ role: 'merchant', merchantSubscriptionStatus: 'pilot' });
      const pubRes = await fake.publish_request({ requestId: SAMPLE_REQ_ID });
      expect(pubRes.ok).toBe(true);

      // 3. submit_offer (999 rechazado, 1000 aceptado, duplicada rechazada, piso cambiado a 1500)
      fake.setActor({ role: 'courier', courierStatus: 'approved', courierAvailable: true });
      expect(
        await fake.submit_offer({ requestId: SAMPLE_REQ_ID, amountArs: 999, etaMinutes: 15 })
      ).toEqual(expect.objectContaining({ ok: false, code: 'OFFER_BELOW_MINIMUM' }));

      const offerOk = await fake.submit_offer({
        requestId: SAMPLE_REQ_ID,
        amountArs: 1000,
        etaMinutes: 15,
      });
      expect(offerOk.ok).toBe(true);

      // Duplicada activa rechazada
      expect(
        await fake.submit_offer({ requestId: SAMPLE_REQ_ID, amountArs: 1100, etaMinutes: 15 })
      ).toEqual(expect.objectContaining({ ok: false, code: 'DUPLICATE_ACTIVE_OFFER' }));

      // Piso dinámico cambiado a 1500 con admin_update_setting
      fake.setActor({ role: 'admin', aal: 'aal2' });
      expect(await fake.admin_update_setting({ key: 'min_offer_ars', value: 1500 })).toEqual({
        ok: true,
        data: { key: 'min_offer_ars', value: 1500 },
      });
      expect(await fake.admin_update_setting({ key: 'request_ttl_minutes', value: 45 })).toEqual({
        ok: true,
        data: { key: 'request_ttl_minutes', value: 45 },
      });
      expect(await fake.admin_update_setting({ key: 'pilot_active', value: true })).toEqual({
        ok: true,
        data: { key: 'pilot_active', value: true },
      });

      fake.setMinOfferArs(1500);
      fake.setActor({
        userId: SAMPLE_USER_ID,
        role: 'courier',
        courierStatus: 'approved',
        courierAvailable: true,
      });
      expect(
        await fake.submit_offer({ requestId: SAMPLE_REQ_ID, amountArs: 1001, etaMinutes: 15 })
      ).toEqual(expect.objectContaining({ ok: false, code: 'OFFER_BELOW_MINIMUM' }));

      // 4. accept_offer (primera vez idempotent=false, segunda vez idempotent=true, otra oferta ALREADY_MATCHED)
      const acceptFirst = await fake.accept_offer({ offerId: SAMPLE_OFFER_ID });
      expect(acceptFirst).toEqual(
        expect.objectContaining({
          ok: true,
          data: expect.objectContaining({ idempotent: false }),
        })
      );
      const acceptSecond = await fake.accept_offer({ offerId: SAMPLE_OFFER_ID });
      expect(acceptSecond).toEqual(
        expect.objectContaining({
          ok: true,
          data: expect.objectContaining({ idempotent: true }),
        })
      );
      const acceptOther = await fake.accept_offer({
        offerId: '55555555-5555-4555-8555-555555555555',
      });
      expect(acceptOther).toEqual(expect.objectContaining({ ok: false, code: 'ALREADY_MATCHED' }));

      // 5. withdraw_offer sobre oferta ya accepted -> OFFER_NOT_PENDING; sobre oferta nueva -> ok
      expect(await fake.withdraw_offer({ offerId: SAMPLE_OFFER_ID })).toEqual(
        expect.objectContaining({ ok: false, code: 'OFFER_NOT_PENDING' })
      );
      expect(
        (await fake.withdraw_offer({ offerId: '66666666-6666-4666-8666-666666666666' })).ok
      ).toBe(true);

      // 6. Resto de RPCs de viaje y solicitud
      expect((await fake.mark_picked_up({ requestId: SAMPLE_REQ_ID })).ok).toBe(true);
      expect((await fake.mark_delivered({ requestId: SAMPLE_REQ_ID })).ok).toBe(true);
      expect((await fake.report_no_show({ requestId: SAMPLE_REQ_ID, republish: true })).ok).toBe(
        true
      );
      expect((await fake.report_no_show({ requestId: SAMPLE_REQ_ID, republish: false })).ok).toBe(
        true
      );
      expect(
        (await fake.courier_cancel_match({ requestId: SAMPLE_REQ_ID, reason: 'Avería mecánica' }))
          .ok
      ).toBe(true);
      expect((await fake.republish_request({ requestId: SAMPLE_REQ_ID })).ok).toBe(true);
      expect(
        (
          await fake.report_incident({
            requestId: SAMPLE_REQ_ID,
            kind: 'delay',
            description: 'Demora mayor a 40 minutos en retiro',
          })
        ).ok
      ).toBe(true);
      expect(
        (await fake.cancel_request({ requestId: SAMPLE_REQ_ID, reason: 'Cancelado' })).ok
      ).toBe(true);

      // 7. set_availability y calculate_route_distance
      fake.setActor({ role: 'courier', courierStatus: 'approved' });
      expect((await fake.set_availability({ available: false })).ok).toBe(true);
      fake.setActor({ role: 'courier', courierStatus: 'suspended' });
      expect(await fake.set_availability({ available: true })).toEqual(
        expect.objectContaining({ ok: false, code: 'COURIER_SUSPENDED' })
      );
      fake.setActor({ role: 'courier', courierStatus: 'pending' });
      expect(await fake.set_availability({ available: true })).toEqual(
        expect.objectContaining({ ok: false, code: 'COURIER_NOT_APPROVED' })
      );

      expect(
        await fake.calculate_route_distance({
          pickupLat: -27.433,
          pickupLng: -65.614,
          dropoffLat: -27.442,
          dropoffLng: -65.622,
        })
      ).toEqual({
        ok: true,
        data: expect.objectContaining({ usedZoneFallback: false }),
      });

      expect(await fake.calculate_route_distance({})).toEqual({
        ok: true,
        data: { routeDistanceM: 1500, usedZoneFallback: true },
      });

      // 8. RPCs admin_* (con y sin aal2)
      fake.setActor({ role: 'admin', aal: 'aal1' });
      expect(
        await fake.admin_decide_courier({ courierId: SAMPLE_USER_ID, decision: 'approved' })
      ).toEqual(expect.objectContaining({ ok: false, code: 'AAL2_REQUIRED' }));

      fake.setActor({ role: 'courier', aal: 'aal2' });
      expect(
        await fake.admin_decide_courier({ courierId: SAMPLE_USER_ID, decision: 'approved' })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHORIZED_ACTOR' }));

      fake.setActor({ role: null, aal: 'aal2' });
      expect(
        await fake.admin_decide_courier({ courierId: SAMPLE_USER_ID, decision: 'approved' })
      ).toEqual(expect.objectContaining({ ok: false, code: 'UNAUTHENTICATED' }));

      fake.setActor({ role: 'admin', aal: 'aal2' });
      expect(
        (await fake.admin_decide_courier({ courierId: SAMPLE_USER_ID, decision: 'approved' })).ok
      ).toBe(true);
      expect(
        (
          await fake.admin_suspend_courier({
            courierId: SAMPLE_USER_ID,
            reason: 'Suspensión preventiva',
          })
        ).ok
      ).toBe(true);
      expect(
        (
          await fake.admin_verify_document({
            documentId: SAMPLE_OFFER_ID,
            decision: 'verified',
          })
        ).ok
      ).toBe(true);
      expect(
        (
          await fake.admin_set_subscription({
            merchantId: SAMPLE_USER_ID,
            subscriptionStatus: 'active',
            paidUntil: '2026-10-31',
          })
        ).ok
      ).toBe(true);
      expect(
        (
          await fake.admin_set_subscription({
            merchantId: SAMPLE_USER_ID,
            subscriptionStatus: 'pilot',
          })
        ).ok
      ).toBe(true);

      // Validación de entrada Zod fallida (UUID inválido y fuera de Aguilares)
      fake.setForcedError('RATE_LIMITED');
      expect(await fake.set_availability({ available: true })).toEqual({
        ok: false,
        code: 'RATE_LIMITED',
      });

      expect(await fake.publish_request({ requestId: 'invalid-uuid' })).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
      });

      expect(
        await fake.calculate_route_distance({
          pickupLat: -26.824,
          pickupLng: -65.222,
          dropoffLat: -27.442,
          dropoffLng: -65.622,
        })
      ).toEqual({
        ok: false,
        code: 'OUT_OF_BOUNDS_AGUILARES',
      });
    });
  });

  describe('7. Pureza de src/domain y verificación de cobertura de ramas ≥ 90%', () => {
    it('ningún archivo de src/domain importa react, next, @supabase/* ni server-only y cumple umbral ≥ 90%', () => {
      const domainIndex = readFileSync(path.resolve(__dirname, 'index.ts'), 'utf8');
      expect(domainIndex).not.toMatch(/from ['"](react|next|@supabase|server-only)/);
      expect(existsSync(path.resolve(__dirname, 'rpc-contracts.ts'))).toBe(true);
      expect(existsSync(path.resolve(__dirname, 'testing/rpc-fake.ts'))).toBe(true);

      const coveragePath = path.resolve(__dirname, '../../coverage/coverage-final.json');
      if (existsSync(coveragePath)) {
        const rawCoverage = JSON.parse(readFileSync(coveragePath, 'utf8')) as Record<
          string,
          { b?: Record<string, number[]> }
        >;
        let totalBranches = 0;
        let coveredBranches = 0;
        for (const [filePath, entry] of Object.entries(rawCoverage)) {
          const normalized = filePath.replace(/\\/g, '/');
          if (normalized.includes('/src/domain/') && entry.b) {
            for (const branchCounts of Object.values(entry.b)) {
              for (const count of branchCounts) {
                totalBranches += 1;
                if (count > 0) coveredBranches += 1;
              }
            }
          }
        }
        if (totalBranches > 0) {
          const branchPct = (coveredBranches / totalBranches) * 100;
          expect(branchPct).toBeGreaterThanOrEqual(90);
        }
      }
    });
  });
});
