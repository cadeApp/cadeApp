import { describe, expect, it } from 'vitest';
import {
  AGUILARES_BOUNDS,
  ALL_DOMAIN_ERROR_CODES,
  ALL_RPC_NAMES,
  type DomainErrorCode,
  RPC_CONTRACTS,
  type RpcErrorCode,
  type RpcName,
  adminSetSubscriptionInputSchema,
  adminUpdateSettingInputSchema,
  aguilaresCoordPairSchema,
  calculateHaversineRouteDistanceM,
  calculateRouteDistanceInputSchema,
  calculateRouteDistanceOutputSchema,
  canCourierBeAccepted,
  canCourierSubmitOffer,
  canMerchantPublishRequest,
  canTransitionOffer,
  canTransitionRequest,
  civilDateSchema,
  computeDocLevel,
  createOfferAmountArsSchema,
  err,
  formatZoneToZoneDisplayLabel,
  getCourierDeclaredBadges,
  getCourierVerifiedBadges,
  getEffectiveRequestStatus,
  isDomainErrorCode,
  isErr,
  isOk,
  isRequestExpired,
  isWithinAguilaresBounds,
  isoTimestampSchema,
  ok,
  publishRequestOutputSchema,
  sortOffersForMerchant,
  transitionOffer,
  transitionRequest,
  validateOfferAmountAgainstFloor,
  validateRoutePointsAndCalculateDistanceM,
} from './index';
import { type FakePlatformSettings, createFakeRpcClient } from './testing/rpc-fake';

const BASE_SETTINGS: FakePlatformSettings = {
  minOfferArs: 1200,
  maxOffersPerMin: 10,
  requestTtlMinutes: 25,
  pilotActive: true,
  pilotTermsVersion: 'v1.0',
  subscriptionGraceDays: 3,
};

const MERCHANT_1 = '10000000-0000-4000-8000-000000000001';
const MERCHANT_2 = '10000000-0000-4000-8000-000000000002';
const COURIER_1 = '20000000-0000-4000-8000-000000000001';
const COURIER_2 = '20000000-0000-4000-8000-000000000002';
const ADMIN_1 = '90000000-0000-4000-8000-000000000001';
const REQ_1 = '30000000-0000-4000-8000-000000000001';
const REQ_2 = '30000000-0000-4000-8000-000000000002';
const REQ_MISSING = '30000000-0000-4000-8000-999999999999';
const DOC_1 = '40000000-0000-4000-8000-000000000001';
const DOC_2 = '40000000-0000-4000-8000-000000000002';

describe('T-006 — Contratos de dominio y rondas conductuales (H01..H13)', () => {
  describe('Clúster 1 — Máquina de estados: evidencia positiva (H01) y REASON_REQUIRED (H02)', () => {
    const now = new Date('2026-09-22T15:00:00.000Z');
    const future = new Date('2026-09-22T15:30:00.000Z');
    const past = new Date('2026-09-22T14:30:00.000Z');

    it('H01: rechaza con UNAUTHORIZED_ACTOR u omisión de suscripción las 8 guardas protegidas cuando falta evidencia positiva', () => {
      expect(
        transitionRequest({
          from: 'draft',
          to: 'published',
          actor: 'merchant',
          now,
          subscriptionStatus: 'pilot',
          pilotActive: true,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'draft',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          now,
          pilotActive: true,
        })
      ).toEqual({ ok: false, code: 'SUBSCRIPTION_INACTIVE' });

      expect(
        transitionRequest({
          from: 'published',
          to: 'matched',
          actor: 'merchant',
          expiresAt: future,
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'published',
          to: 'cancelled',
          actor: 'merchant',
          expiresAt: future,
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'matched',
          to: 'in_transit',
          actor: 'courier',
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'merchant',
          reason: 'Repartidor no vino',
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'courier',
          reason: 'Se me pinchó la rueda',
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'matched',
          to: 'cancelled',
          actor: 'merchant',
          reason: 'Cliente canceló pedido',
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'delivered',
          actor: 'courier',
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    });

    it('H02: devuelve REASON_REQUIRED (y no VALIDATION_ERROR) en las 4 ramas que exigen motivo obligatorio', () => {
      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          reason: '   ',
          now,
        })
      ).toEqual({ ok: false, code: 'REASON_REQUIRED' });

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'courier',
          isAssignedCourier: true,
          reason: '',
          now,
        })
      ).toEqual({ ok: false, code: 'REASON_REQUIRED' });

      expect(
        transitionRequest({
          from: 'matched',
          to: 'cancelled',
          actor: 'merchant',
          isOwnerMerchant: true,
          reason: null,
          now,
        })
      ).toEqual({ ok: false, code: 'REASON_REQUIRED' });

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'cancelled',
          actor: 'admin',
          reason: undefined,
          now,
        })
      ).toEqual({ ok: false, code: 'REASON_REQUIRED' });
    });

    it('permite todas las transiciones válidas con evidencia positiva y evalúa expiración, ofertas y elegibilidad', () => {
      expect(
        transitionRequest({
          from: 'draft',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          subscriptionStatus: 'active',
          paidUntil: '2026-09-25',
          pilotActive: false,
          now,
        })
      ).toEqual({ ok: true, data: { status: 'published', offerSideEffect: 'none' } });

      expect(
        transitionRequest({
          from: 'published',
          to: 'matched',
          actor: 'merchant',
          isOwnerMerchant: true,
          expiresAt: past,
          now,
        })
      ).toEqual({ ok: false, code: 'REQUEST_EXPIRED' });

      expect(
        transitionRequest({
          from: 'published',
          to: 'expired',
          actor: 'merchant',
          expiresAt: past,
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'published',
          to: 'expired',
          actor: 'system',
          expiresAt: future,
          now,
        })
      ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });

      expect(
        transitionRequest({
          from: 'published',
          to: 'expired',
          actor: 'system',
          expiresAt: past,
          now,
        })
      ).toEqual({ ok: true, data: { status: 'expired', offerSideEffect: 'expire_all_pending' } });

      expect(
        transitionRequest({
          from: 'matched',
          to: 'published',
          actor: 'system',
          reason: 'x',
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'cancelled',
          actor: 'merchant',
          reason: 'x',
          now,
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(
        transitionRequest({
          from: 'in_transit',
          to: 'cancelled',
          actor: 'admin',
          reason: 'Incidente operativo',
          now,
        })
      ).toEqual({ ok: true, data: { status: 'cancelled', offerSideEffect: 'cancel_accepted' } });

      expect(
        transitionRequest({
          from: 'delivered',
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: true,
          now,
        })
      ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });

      expect(canTransitionRequest('draft', 'published', 'merchant')).toBe(true);
      expect(canTransitionRequest('published', 'expired', 'system')).toBe(true);
      expect(canTransitionRequest('delivered', 'cancelled', 'admin')).toBe(false);

      expect(getEffectiveRequestStatus('published', past.toISOString(), now)).toBe('expired');
      expect(getEffectiveRequestStatus('published', 'invalid-date', now)).toBe('published');
      expect(getEffectiveRequestStatus('draft', past.toISOString(), now)).toBe('draft');

      expect(
        canMerchantPublishRequest({
          subscriptionStatus: 'cancelled',
          pilotActive: true,
          paidUntil: '2026-10-01',
          now,
        })
      ).toEqual({ ok: false, code: 'SUBSCRIPTION_INACTIVE' });

      expect(
        canMerchantPublishRequest({
          subscriptionStatus: 'active',
          pilotActive: false,
          paidUntil: '2026-09-20',
          graceDays: 3,
          now,
        })
      ).toEqual({ ok: true, data: true });

      expect(transitionOffer('pending', 'withdrawn', 'courier')).toEqual({
        ok: true,
        data: 'withdrawn',
      });
      expect(transitionOffer('pending', 'withdrawn', 'merchant')).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });
      expect(transitionOffer('pending', 'accepted', 'merchant')).toEqual({
        ok: true,
        data: 'accepted',
      });
      expect(transitionOffer('pending', 'accepted', 'courier')).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });
      expect(transitionOffer('pending', 'rejected', 'system')).toEqual({
        ok: true,
        data: 'rejected',
      });
      expect(transitionOffer('pending', 'rejected', 'courier')).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });
      expect(transitionOffer('pending', 'expired', 'system')).toEqual({
        ok: true,
        data: 'expired',
      });
      expect(transitionOffer('pending', 'expired', 'courier')).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });
      expect(transitionOffer('accepted', 'cancelled', 'merchant')).toEqual({
        ok: true,
        data: 'cancelled',
      });
      expect(transitionOffer('withdrawn', 'accepted', 'merchant')).toEqual({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
      expect(canTransitionOffer('pending', 'accepted', 'merchant')).toBe(true);

      expect(canCourierSubmitOffer({ status: 'suspended', available: true })).toEqual({
        ok: false,
        code: 'COURIER_SUSPENDED',
      });
      expect(canCourierSubmitOffer({ status: 'pending', available: true })).toEqual({
        ok: false,
        code: 'COURIER_NOT_APPROVED',
      });
      expect(canCourierSubmitOffer({ status: 'approved', available: false })).toEqual({
        ok: false,
        code: 'COURIER_UNAVAILABLE',
      });
      expect(canCourierSubmitOffer({ status: 'approved', available: true })).toEqual({
        ok: true,
        data: true,
      });

      expect(canCourierBeAccepted({ status: 'suspended' })).toEqual({
        ok: false,
        code: 'COURIER_SUSPENDED',
      });
      expect(canCourierBeAccepted({ status: 'rejected' })).toEqual({
        ok: false,
        code: 'COURIER_NOT_APPROVED',
      });
      expect(canCourierBeAccepted({ status: 'approved' })).toEqual({
        ok: true,
        data: true,
      });
    });
  });

  describe('Clúster 2 — Schemas y contratos RPC: distancia/barrios (H03), unión discriminada (H04), ISO (H10) y ActionFailure puro (H11)', () => {
    it('H03: calculateHaversineRouteDistanceM devuelve 0 para puntos idénticos, calculate_route_distance rechaza coordenadas parciales y modela modo sin coordenadas con etiqueta "De barrio X a barrio Y"', () => {
      const samePoint = { lat: -27.432, lng: -65.615 };
      expect(calculateHaversineRouteDistanceM(samePoint, samePoint)).toBe(0);
      expect(
        calculateHaversineRouteDistanceM(samePoint, { lat: -27.425, lng: -65.608 })
      ).toBeGreaterThanOrEqual(500);

      expect(
        validateRoutePointsAndCalculateDistanceM(samePoint, { lat: -26.8, lng: -65.2 })
      ).toEqual({ ok: false, code: 'OUT_OF_BOUNDS_AGUILARES' });
      expect(validateRoutePointsAndCalculateDistanceM(samePoint, samePoint)).toEqual({
        ok: true,
        data: 0,
      });

      const partial = calculateRouteDistanceInputSchema.safeParse({
        pickupLat: -27.432,
        pickupLng: -65.615,
        dropoffLat: null,
        dropoffLng: null,
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Villa Nueva',
      });
      expect(partial.success).toBe(false);

      const zoneOnlyInput = calculateRouteDistanceInputSchema.safeParse({
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Villa Nueva',
      });
      expect(zoneOnlyInput.success).toBe(true);

      const zoneOnlyOutput = calculateRouteDistanceOutputSchema.safeParse({
        routeDistanceM: null,
        displayLabel: formatZoneToZoneDisplayLabel('Centro', 'Villa Nueva'),
      });
      expect(zoneOnlyOutput.success).toBe(true);

      expect(aguilaresCoordPairSchema.safeParse({ lat: -27.432, lng: null }).success).toBe(false);
      expect(aguilaresCoordPairSchema.safeParse({ lat: -27.432, lng: -65.615 }).success).toBe(true);
      expect(isWithinAguilaresBounds(AGUILARES_BOUNDS.minLat, AGUILARES_BOUNDS.minLng)).toBe(true);
      expect(createOfferAmountArsSchema(1200).safeParse(1100).success).toBe(false);
      expect(createOfferAmountArsSchema(1200).safeParse(1200).success).toBe(true);
      expect(validateOfferAmountAgainstFloor(1200, 0)).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
      });
    });

    it('H04: adminUpdateSettingInputSchema es unión discriminada por clave y rechaza tipos cruzados', () => {
      expect(
        adminUpdateSettingInputSchema.safeParse({ key: 'pilot_active', value: 1 }).success
      ).toBe(false);
      expect(
        adminUpdateSettingInputSchema.safeParse({ key: 'min_offer_ars', value: true }).success
      ).toBe(false);
      expect(
        adminUpdateSettingInputSchema.safeParse({ key: 'min_offer_ars', value: 0 }).success
      ).toBe(false);
      expect(
        adminUpdateSettingInputSchema.safeParse({ key: 'request_ttl_minutes', value: 0 }).success
      ).toBe(false);
      expect(
        adminUpdateSettingInputSchema.safeParse({ key: 'pilot_terms_version', value: '   ' })
          .success
      ).toBe(false);
      expect(
        adminUpdateSettingInputSchema.safeParse({ key: 'subscription_grace_days', value: -1 })
          .success
      ).toBe(false);

      expect(
        adminUpdateSettingInputSchema.safeParse({ key: 'min_offer_ars', value: 1500 }).success
      ).toBe(true);
      expect(
        adminUpdateSettingInputSchema.safeParse({ key: 'pilot_active', value: false }).success
      ).toBe(true);
    });

    it('H10 y H11: los campos temporales validan formato ISO / fecha civil real y err() devuelve únicamente { ok: false, code }', () => {
      expect(isoTimestampSchema.safeParse('not-a-date').success).toBe(false);
      expect(isoTimestampSchema.safeParse('2026-09-22T15:00:00.000Z').success).toBe(true);
      expect(civilDateSchema.safeParse('2026-02-30').success).toBe(false);
      expect(civilDateSchema.safeParse('2026-09-22').success).toBe(true);

      const invalidPublished = publishRequestOutputSchema.safeParse({
        requestId: REQ_1,
        status: 'published',
        publishedAt: 'not-a-date',
        expiresAt: 'also-invalid',
        routeDistanceM: 1000,
      });
      expect(invalidPublished.success).toBe(false);

      const invalidSub = adminSetSubscriptionInputSchema.safeParse({
        merchantId: MERCHANT_1,
        subscriptionStatus: 'active',
        paidUntil: 'not-a-civil-date',
      });
      expect(invalidSub.success).toBe(false);

      const failure = err('UNAUTHORIZED_ACTOR');
      expect(Object.keys(failure)).toEqual(['ok', 'code']);
      expect('message' in failure).toBe(false);
      expect(isErr(failure)).toBe(true);
      expect(isOk(failure)).toBe(false);
      const success = ok(42);
      expect(isOk(success)).toBe(true);
      expect(isErr(success)).toBe(false);
      expect(isDomainErrorCode('UNAUTHORIZED_ACTOR')).toBe(true);
      expect(isDomainErrorCode('NON_EXISTENT')).toBe(false);
    });

    it('ordena ofertas según la prioridad de desempate (doc_level vs price) y calcula insignias de repartidor', () => {
      expect(computeDocLevel('verified', 'verified')).toBe(2);
      expect(computeDocLevel('verified', 'none')).toBe(1);
      expect(computeDocLevel('none', 'none')).toBe(0);

      expect(getCourierVerifiedBadges('verified', 'verified')).toEqual([
        'license_verified',
        'insurance_verified',
      ]);
      expect(getCourierVerifiedBadges('none', 'rejected')).toEqual([]);

      expect(
        getCourierDeclaredBadges({
          licenseStatus: 'submitted',
          insuranceStatus: 'submitted',
          vehicleType: 'moto',
        })
      ).toEqual(['vehicle_declared', 'license_declared', 'insurance_declared']);
      expect(
        getCourierDeclaredBadges({
          licenseStatus: 'none',
          insuranceStatus: 'none',
          vehicleType: null,
        })
      ).toEqual([]);

      const o1 = {
        id: 'b-offer',
        amountArs: 1500,
        docLevel: 1 as const,
        createdAt: '2026-09-22T15:00:00.000Z',
      };
      const o2 = {
        id: 'a-offer',
        amountArs: 1200,
        docLevel: 1 as const,
        createdAt: new Date('2026-09-22T15:00:00.000Z'),
      };
      const o3 = {
        id: 'c-offer',
        amountArs: 1800,
        docLevel: 2 as const,
        createdAt: '2026-09-22T15:05:00.000Z',
      };
      const o4 = {
        id: 'd-offer',
        amountArs: 1500,
        docLevel: 1 as const,
        createdAt: '2026-09-22T14:55:00.000Z',
      };
      const o5 = {
        id: 'e-offer',
        amountArs: 1200,
        docLevel: 1 as const,
        createdAt: '2026-09-22T15:00:00.000Z',
      };

      const byDoc = sortOffersForMerchant([o1, o2, o3, o4, o5], 'doc_level');
      expect(byDoc.map((o) => o.id)).toEqual([
        'c-offer',
        'd-offer',
        'a-offer',
        'e-offer',
        'b-offer',
      ]);

      const byPrice = sortOffersForMerchant([o1, o3, o2], 'price');
      expect(byPrice.map((o) => o.id)).toEqual(['a-offer', 'b-offer', 'c-offer']);
    });
  });

  describe('Clúster 3 — Fake conductual: sin defaults ocultos (H09), autenticación en las 13 RPC (H06), NOT_FOUND/estado real (H07), IDs únicos (H08) y códigos por RPC (H05)', () => {
    it('H09: createFakeRpcClient exige settings explícitos y prohíbe defaults ocultos', () => {
      expect(() =>
        createFakeRpcClient({} as unknown as Parameters<typeof createFakeRpcClient>[0])
      ).toThrow();
      expect(() =>
        createFakeRpcClient({
          settings: { ...BASE_SETTINGS, minOfferArs: 0 },
        })
      ).toThrow();
      expect(() =>
        createFakeRpcClient({
          settings: { ...BASE_SETTINGS, maxOffersPerMin: 0 },
        })
      ).toThrow();
    });

    it('H06: las 13 RPC no administrativas rechazan un actor no autenticado (role: null) con UNAUTHENTICATED y rol incorrecto con UNAUTHORIZED_ACTOR', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: { role: null },
      });

      const nonAdminCalls = [
        () => fake.publish_request({ requestId: REQ_1 }),
        () => fake.cancel_request({ requestId: REQ_1 }),
        () => fake.submit_offer({ requestId: REQ_1, amountArs: 1500, etaMinutes: 15 }),
        () => fake.withdraw_offer({ offerId: REQ_1 }),
        () => fake.accept_offer({ offerId: REQ_1 }),
        () => fake.mark_picked_up({ requestId: REQ_1 }),
        () => fake.mark_delivered({ requestId: REQ_1 }),
        () => fake.report_no_show({ requestId: REQ_1, republish: true }),
        () => fake.courier_cancel_match({ requestId: REQ_1, reason: 'Pinchadura' }),
        () => fake.republish_request({ requestId: REQ_1, reason: 'Reintento' }),
        () =>
          fake.report_incident({
            requestId: REQ_1,
            kind: 'delay',
            description: 'Demora en el retiro',
          }),
        () => fake.set_availability({ available: true }),
        () =>
          fake.calculate_route_distance({
            pickupZoneName: 'Centro',
            dropoffZoneName: 'Villa Nueva',
          }),
      ];

      for (const call of nonAdminCalls) {
        const res = await call();
        expect(res).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
      }

      fake.setActor({ userId: COURIER_1, role: 'courier' });
      expect(await fake.publish_request({ requestId: REQ_1 })).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });
      expect(await fake.accept_offer({ offerId: REQ_1 })).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });

      fake.setActor({ userId: MERCHANT_1, role: 'merchant' });
      expect(
        await fake.submit_offer({ requestId: REQ_1, amountArs: 1500, etaMinutes: 15 })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      expect(await fake.admin_update_setting({ key: 'min_offer_ars', value: 1400 })).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });

      fake.setActor({ userId: ADMIN_1, role: 'admin', aal: 'aal1' });
      expect(await fake.admin_update_setting({ key: 'min_offer_ars', value: 1400 })).toEqual({
        ok: false,
        code: 'AAL2_REQUIRED',
      });
    });

    it('H07 y H08: el fake devuelve NOT_FOUND ante UUID inexistente, genera IDs únicos para múltiples ofertas, rechaza las restantes al aceptar una y ejecuta el ciclo completo de las 18 RPC', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: {
          userId: MERCHANT_1,
          role: 'merchant',
          merchantSubscriptionStatus: 'pilot',
        },
        initialRequests: [
          {
            requestId: REQ_1,
            merchantId: MERCHANT_1,
            status: 'draft',
            pickupLat: -27.432,
            pickupLng: -65.615,
            dropoffLat: -27.425,
            dropoffLng: -65.608,
            pickupZoneName: 'Centro',
            dropoffZoneName: 'Villa Nueva',
          },
          {
            requestId: REQ_2,
            merchantId: MERCHANT_1,
            status: 'draft',
            pickupZoneName: 'Centro',
            dropoffZoneName: 'Norte',
          },
        ],
        initialCouriers: [
          { courierId: COURIER_1, status: 'approved', available: true },
          { courierId: COURIER_2, status: 'approved', available: true },
        ],
        initialMerchants: [{ merchantId: MERCHANT_1, subscriptionStatus: 'pilot' }],
        initialDocuments: [
          { documentId: DOC_1, courierId: COURIER_1, kind: 'license', status: 'submitted' },
          { documentId: DOC_2, courierId: COURIER_1, kind: 'insurance', status: 'submitted' },
        ],
      });

      // NOT_FOUND checks on missing entities
      expect(await fake.publish_request({ requestId: REQ_MISSING })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await fake.cancel_request({ requestId: REQ_MISSING })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await fake.accept_offer({ offerId: REQ_MISSING })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await fake.report_no_show({ requestId: REQ_MISSING })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await fake.republish_request({ requestId: REQ_MISSING })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });

      // Publish REQ_1 (with coordinates -> Haversine) and REQ_2 (without coordinates -> null distance)
      const pub1 = await fake.publish_request({ requestId: REQ_1 });
      expect(pub1.ok).toBe(true);
      if (pub1.ok) {
        expect(pub1.data.routeDistanceM).toBeGreaterThanOrEqual(500);
      }

      const pub2 = await fake.publish_request({ requestId: REQ_2 });
      expect(pub2.ok).toBe(true);
      if (pub2.ok) {
        expect(pub2.data.routeDistanceM).toBeNull();
      }

      // Courier 1 and Courier 2 submit offers on REQ_1
      fake.setActor({
        userId: COURIER_1,
        role: 'courier',
        courierStatus: 'approved',
        courierAvailable: true,
      });
      expect(
        await fake.submit_offer({ requestId: REQ_MISSING, amountArs: 1300, etaMinutes: 10 })
      ).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      const offer1Res = await fake.submit_offer({
        requestId: REQ_1,
        amountArs: 1300,
        etaMinutes: 15,
      });
      expect(offer1Res.ok).toBe(true);

      // Duplicate active offer by same courier on same request
      expect(
        await fake.submit_offer({ requestId: REQ_1, amountArs: 1400, etaMinutes: 15 })
      ).toEqual({ ok: false, code: 'DUPLICATE_ACTIVE_OFFER' });

      // Courier 2 submits offer on REQ_1 and REQ_2
      fake.setActor({
        userId: COURIER_2,
        role: 'courier',
        courierStatus: 'approved',
        courierAvailable: true,
      });
      const offer2Res = await fake.submit_offer({
        requestId: REQ_1,
        amountArs: 1400,
        etaMinutes: 12,
      });
      const offer3Res = await fake.submit_offer({
        requestId: REQ_2,
        amountArs: 1500,
        etaMinutes: 20,
      });
      expect(offer2Res.ok).toBe(true);
      expect(offer3Res.ok).toBe(true);

      if (!offer1Res.ok || !offer2Res.ok || !offer3Res.ok) {
        throw new Error('Expected offers to succeed');
      }

      // Unique offer IDs (H08)
      expect(offer1Res.data.offerId).not.toBe(offer2Res.data.offerId);
      expect(offer2Res.data.offerId).not.toBe(offer3Res.data.offerId);

      // Merchant accepts offer 1 -> offer 1 becomes accepted, offer 2 becomes rejected (H08)
      fake.setActor({ userId: MERCHANT_1, role: 'merchant' });
      const accept1 = await fake.accept_offer({ offerId: offer1Res.data.offerId });
      expect(accept1.ok).toBe(true);
      expect(fake.getOffer(offer1Res.data.offerId)?.status).toBe('accepted');
      expect(fake.getOffer(offer2Res.data.offerId)?.status).toBe('rejected');

      // Idempotent re-accept of same offer vs ALREADY_MATCHED on different offer
      const acceptIdempotent = await fake.accept_offer({ offerId: offer1Res.data.offerId });
      expect(acceptIdempotent).toEqual({
        ok: true,
        data: expect.objectContaining({ idempotent: true }),
      });
      expect(await fake.accept_offer({ offerId: offer2Res.data.offerId })).toEqual({
        ok: false,
        code: 'ALREADY_MATCHED',
      });

      // Courier cancels match -> returns to published, then Courier 1 re-offers and delivers
      fake.setActor({ userId: COURIER_1, role: 'courier' });
      const cancelMatch = await fake.courier_cancel_match({
        requestId: REQ_1,
        reason: 'Inconveniente mecánico',
      });
      expect(cancelMatch.ok).toBe(true);
      expect(fake.getRequest(REQ_1)?.status).toBe('published');

      const offer4Res = await fake.submit_offer({
        requestId: REQ_1,
        amountArs: 1350,
        etaMinutes: 10,
      });
      if (!offer4Res.ok) throw new Error('Expected offer4 to succeed');

      fake.setActor({ userId: MERCHANT_1, role: 'merchant' });
      await fake.accept_offer({ offerId: offer4Res.data.offerId });

      // Non-assigned courier cannot mark picked up
      fake.setActor({ userId: COURIER_2, role: 'courier' });
      expect(await fake.mark_picked_up({ requestId: REQ_1 })).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });

      // Assigned courier marks picked up and delivered
      fake.setActor({ userId: COURIER_1, role: 'courier' });
      const picked = await fake.mark_picked_up({ requestId: REQ_1 });
      expect(picked.ok).toBe(true);
      const delivered = await fake.mark_delivered({ requestId: REQ_1 });
      expect(delivered.ok).toBe(true);
      expect(fake.getRequest(REQ_1)?.status).toBe('delivered');

      // Incident report & route distance calculation (with coords & zone-only)
      const incident = await fake.report_incident({
        requestId: REQ_1,
        kind: 'package_issue',
        description: 'Paquete entregado con observación',
      });
      expect(incident.ok).toBe(true);

      const distCoords = await fake.calculate_route_distance({
        pickupLat: -27.432,
        pickupLng: -65.615,
        dropoffLat: -27.425,
        dropoffLng: -65.608,
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Villa Nueva',
      });
      expect(distCoords).toEqual({
        ok: true,
        data: {
          routeDistanceM: expect.any(Number),
          displayLabel: 'De barrio Centro a barrio Villa Nueva',
        },
      });

      const distZones = await fake.calculate_route_distance({
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Villa Nueva',
      });
      expect(distZones).toEqual({
        ok: true,
        data: {
          routeDistanceM: null,
          displayLabel: 'De barrio Centro a barrio Villa Nueva',
        },
      });

      // Admin RPCs (decide courier, verify documents, suspend courier withdrawing pending offer3 on REQ_2, set subscription, update setting)
      fake.setActor({ userId: ADMIN_1, role: 'admin', aal: 'aal2' });
      expect(
        await fake.admin_decide_courier({ courierId: COURIER_1, decision: 'approved' })
      ).toEqual({
        ok: true,
        data: expect.objectContaining({ courierId: COURIER_1, status: 'approved' }),
      });

      const doc1Verify = await fake.admin_verify_document({
        documentId: DOC_1,
        decision: 'verified',
      });
      expect(doc1Verify).toEqual({
        ok: true,
        data: expect.objectContaining({ docLevel: 1 }),
      });
      const doc2Verify = await fake.admin_verify_document({
        documentId: DOC_2,
        decision: 'verified',
      });
      expect(doc2Verify).toEqual({
        ok: true,
        data: expect.objectContaining({ docLevel: 2 }),
      });

      const suspendRes = await fake.admin_suspend_courier({
        courierId: COURIER_2,
        reason: 'Incumplimiento reiterado',
      });
      expect(suspendRes).toEqual({
        ok: true,
        data: expect.objectContaining({
          courierId: COURIER_2,
          status: 'suspended',
          withdrawnOffersCount: 1,
        }),
      });
      expect(fake.getOffer(offer3Res.data.offerId)?.status).toBe('withdrawn');

      const setSubRes = await fake.admin_set_subscription({
        merchantId: MERCHANT_1,
        subscriptionStatus: 'active',
        paidUntil: '2026-12-31',
      });
      expect(setSubRes).toEqual({
        ok: true,
        data: {
          merchantId: MERCHANT_1,
          subscriptionStatus: 'active',
          paidUntil: '2026-12-31',
        },
      });

      const updateSettingRes = await fake.admin_update_setting({
        key: 'min_offer_ars',
        value: 1600,
      });
      expect(updateSettingRes).toEqual({
        ok: true,
        data: { key: 'min_offer_ars', value: 1600 },
      });
      expect(fake.getSettings().minOfferArs).toBe(1600);
      // Additional fake coverage: withdraw_offer, report_no_show, republish_request, cancel_request, set_availability, setForcedError, setMinOfferArs, all admin_update_setting keys
      await fake.admin_update_setting({ key: 'request_ttl_minutes', value: 40 });
      await fake.admin_update_setting({ key: 'pilot_active', value: true });
      await fake.admin_update_setting({ key: 'pilot_terms_version', value: 'v2.0' });
      await fake.admin_update_setting({ key: 'subscription_grace_days', value: 5 });
      expect(fake.getSettings().requestTtlMinutes).toBe(40);
      expect(fake.getSettings().pilotTermsVersion).toBe('v2.0');
      expect(fake.getSettings().subscriptionGraceDays).toBe(5);

      fake.setMinOfferArs(1100);
      expect(() => fake.setMinOfferArs(0)).toThrow();
      expect(fake.getSettings().minOfferArs).toBe(1100);

      fake.setForcedError('publish_request', 'RATE_LIMITED');
      expect(await fake.publish_request({ requestId: REQ_2 })).toEqual({
        ok: false,
        code: 'RATE_LIMITED',
      });
      fake.setForcedError('publish_request', null);

      // Courier 1 submits offer on REQ_2, withdraws it, then submits another offer
      fake.setActor({
        userId: COURIER_1,
        role: 'courier',
        courierStatus: 'approved',
        courierAvailable: true,
      });
      expect(await fake.set_availability({ available: true })).toEqual({
        ok: true,
        data: { courierId: COURIER_1, available: true },
      });
      expect(fake.getCourier(COURIER_1)?.available).toBe(true);

      const offer5Res = await fake.submit_offer({
        requestId: REQ_2,
        amountArs: 1200,
        etaMinutes: 15,
      });
      if (!offer5Res.ok) throw new Error('Expected offer5 to succeed');

      const withdrawRes = await fake.withdraw_offer({ offerId: offer5Res.data.offerId });
      expect(withdrawRes.ok).toBe(true);
      expect(await fake.withdraw_offer({ offerId: offer5Res.data.offerId })).toEqual({
        ok: false,
        code: 'OFFER_NOT_PENDING',
      });

      const offer6Res = await fake.submit_offer({
        requestId: REQ_2,
        amountArs: 1250,
        etaMinutes: 15,
      });
      if (!offer6Res.ok) throw new Error('Expected offer6 to succeed');

      // Merchant accepts offer6 on REQ_2, then reports no-show (republish: true), then accepts again and reports no-show (republish: false), then republishes
      fake.setActor({ userId: MERCHANT_1, role: 'merchant' });
      await fake.accept_offer({ offerId: offer6Res.data.offerId });
      const noShowRepublish = await fake.report_no_show({ requestId: REQ_2, republish: true });
      expect(noShowRepublish.ok).toBe(true);

      fake.setActor({ userId: COURIER_1, role: 'courier' });
      const offer7Res = await fake.submit_offer({
        requestId: REQ_2,
        amountArs: 1250,
        etaMinutes: 15,
      });
      if (!offer7Res.ok) throw new Error('Expected offer7 to succeed');

      fake.setActor({ userId: MERCHANT_1, role: 'merchant' });
      await fake.accept_offer({ offerId: offer7Res.data.offerId });
      const noShowCancel = await fake.report_no_show({ requestId: REQ_2, republish: false });
      expect(noShowCancel.ok).toBe(true);
      expect(fake.getRequest(REQ_2)?.status).toBe('cancelled');

      const republishRes = await fake.republish_request({
        requestId: REQ_2,
        reason: 'Publicar nuevamente',
      });
      expect(republishRes.ok).toBe(true);
      expect(fake.getRequest(REQ_2)?.status).toBe('published');

      const cancelPubRes = await fake.cancel_request({
        requestId: REQ_2,
        reason: 'Comercio cerró',
      });
      expect(cancelPubRes.ok).toBe(true);

      // Additional error branches in rpc-contracts & rpc-fake
      expect(validateOfferAmountAgainstFloor(800, 1200)).toEqual({
        ok: false,
        code: 'OFFER_BELOW_MINIMUM',
      });
      expect(validateOfferAmountAgainstFloor(1200, 1200)).toEqual({
        ok: true,
        data: 1200,
      });

      // Invalid schema input in executeRpc -> VALIDATION_ERROR
      expect(await fake.publish_request({ requestId: 'not-a-uuid' })).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
      });

      // NOT_FOUND & guard branches across remaining RPCs
      fake.setActor({
        userId: COURIER_1,
        role: 'courier',
        courierStatus: 'approved',
        courierAvailable: true,
      });
      expect(await fake.withdraw_offer({ offerId: REQ_MISSING })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await fake.mark_picked_up({ requestId: REQ_MISSING })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await fake.mark_delivered({ requestId: REQ_MISSING })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await fake.courier_cancel_match({ requestId: REQ_MISSING, reason: 'x' })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(
        await fake.report_incident({
          requestId: REQ_MISSING,
          kind: 'delay',
          description: 'No existe',
        })
      ).toEqual({ ok: false, code: 'NOT_FOUND' });

      const distCoordsNoZones = await fake.calculate_route_distance({
        pickupLat: -27.432,
        pickupLng: -65.615,
        dropoffLat: -27.425,
        dropoffLng: -65.608,
      });
      expect(distCoordsNoZones.ok).toBe(true);

      // Seed helpers & admin error branches
      fake.seedRequest({
        requestId: '30000000-0000-4000-8000-000000000009',
        merchantId: MERCHANT_1,
        status: 'matched',
        acceptedOfferId: offer7Res.data.offerId,
        assignedCourierId: COURIER_1,
      });
      fake.seedOffer({
        offerId: '50000000-0000-4000-8000-000000000009',
        requestId: '30000000-0000-4000-8000-000000000009',
        courierId: COURIER_1,
        amountArs: 1300,
        status: 'accepted',
      });
      fake.seedCourier({ courierId: COURIER_1, status: 'pending', available: false });
      fake.seedMerchant({ merchantId: MERCHANT_2, subscriptionStatus: 'expired' });
      fake.seedDocument({
        documentId: '40000000-0000-4000-8000-000000000009',
        courierId: COURIER_1,
        kind: 'dni_front',
        status: 'submitted',
      });

      expect(await fake.set_availability({ available: true })).toEqual({
        ok: false,
        code: 'COURIER_NOT_APPROVED',
      });
      fake.seedCourier({ courierId: COURIER_1, status: 'suspended', available: false });
      expect(await fake.set_availability({ available: true })).toEqual({
        ok: false,
        code: 'COURIER_SUSPENDED',
      });

      // Republish from matched without reason -> REASON_REQUIRED, with reason -> published
      fake.setActor({ userId: MERCHANT_1, role: 'merchant' });
      expect(
        await fake.republish_request({
          requestId: '30000000-0000-4000-8000-000000000009',
          reason: '   ',
        })
      ).toEqual({ ok: false, code: 'REASON_REQUIRED' });
      expect(
        await fake.republish_request({
          requestId: '30000000-0000-4000-8000-000000000009',
          reason: 'Demora excesiva',
        })
      ).toEqual({
        ok: true,
        data: expect.objectContaining({ status: 'published' }),
      });

      // Admin NOT_FOUND and REASON_REQUIRED branches
      fake.setActor({ userId: ADMIN_1, role: 'admin', aal: 'aal2' });
      expect(
        await fake.admin_decide_courier({ courierId: REQ_MISSING, decision: 'approved' })
      ).toEqual({ ok: false, code: 'NOT_FOUND' });
      expect(
        await fake.admin_decide_courier({
          courierId: COURIER_1,
          decision: 'rejected',
          reason: '  ',
        })
      ).toEqual({ ok: false, code: 'REASON_REQUIRED' });
      expect(
        await fake.admin_suspend_courier({ courierId: REQ_MISSING, reason: 'Motivo' })
      ).toEqual({ ok: false, code: 'NOT_FOUND' });
      expect(
        await fake.admin_verify_document({ documentId: REQ_MISSING, decision: 'verified' })
      ).toEqual({ ok: false, code: 'NOT_FOUND' });
      expect(
        await fake.admin_verify_document({
          documentId: DOC_1,
          decision: 'rejected',
          reason: '',
        })
      ).toEqual({ ok: false, code: 'REASON_REQUIRED' });
      expect(
        await fake.admin_set_subscription({
          merchantId: REQ_MISSING,
          subscriptionStatus: 'active',
        })
      ).toEqual({ ok: false, code: 'NOT_FOUND' });

      // Exercise remaining guard branches in rpc-fake (publish out-of-bounds, withdraw non-owner, accept non-owner/suspended/non-pending, mark_picked_up suspended/pending, cancel matched)
      fake.seedRequest({
        requestId: '30000000-0000-4000-8000-000000000010',
        merchantId: MERCHANT_1,
        status: 'draft',
        pickupLat: -26.8,
        pickupLng: -65.2,
        dropoffLat: -27.425,
        dropoffLng: -65.608,
      });
      fake.setActor({ userId: MERCHANT_1, role: 'merchant', merchantSubscriptionStatus: 'pilot' });
      expect(
        await fake.publish_request({ requestId: '30000000-0000-4000-8000-000000000010' })
      ).toEqual({ ok: false, code: 'OUT_OF_BOUNDS_AGUILARES' });

      // Cancel matched request (cancels accepted offer)
      fake.seedRequest({
        requestId: '30000000-0000-4000-8000-000000000011',
        merchantId: MERCHANT_1,
        status: 'matched',
        acceptedOfferId: '50000000-0000-4000-8000-000000000009',
        assignedCourierId: COURIER_1,
      });
      expect(
        await fake.cancel_request({
          requestId: '30000000-0000-4000-8000-000000000011',
          reason: 'Cliente canceló',
        })
      ).toEqual({
        ok: true,
        data: expect.objectContaining({ status: 'cancelled' }),
      });

      // Withdraw by non-owner courier & mark_picked_up with suspended/pending courier
      fake.setActor({
        userId: COURIER_2,
        role: 'courier',
        courierStatus: 'approved',
        courierAvailable: true,
      });
      expect(
        await fake.withdraw_offer({ offerId: '50000000-0000-4000-8000-000000000009' })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      fake.seedRequest({
        requestId: '30000000-0000-4000-8000-000000000012',
        merchantId: MERCHANT_1,
        status: 'matched',
        acceptedOfferId: '50000000-0000-4000-8000-000000000009',
        assignedCourierId: COURIER_1,
      });
      fake.setActor({
        userId: COURIER_1,
        role: 'courier',
        courierStatus: 'suspended',
        courierAvailable: false,
      });
      expect(
        await fake.mark_picked_up({ requestId: '30000000-0000-4000-8000-000000000012' })
      ).toEqual({ ok: false, code: 'COURIER_SUSPENDED' });
      fake.setActor({
        userId: COURIER_1,
        role: 'courier',
        courierStatus: 'pending',
        courierAvailable: false,
      });
      expect(
        await fake.mark_picked_up({ requestId: '30000000-0000-4000-8000-000000000012' })
      ).toEqual({ ok: false, code: 'COURIER_NOT_APPROVED' });
      expect(
        await fake.mark_delivered({ requestId: '30000000-0000-4000-8000-000000000012' })
      ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });

      expect(
        await fake.report_incident({
          requestId: REQ_2,
          kind: 'delay',
          description: 'No soy participante',
        })
      ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      fake.setActor({ userId: MERCHANT_1, role: 'merchant' });
      expect(
        await fake.republish_request({
          requestId: REQ_1,
          reason: 'Intento republicar entregado',
        })
      ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });

      fake.setActor({ userId: MERCHANT_2, role: 'merchant' });
      expect(await fake.republish_request({ requestId: REQ_2 })).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });
    });

    it('H05: verifica que todos los códigos de ALL_DOMAIN_ERROR_CODES y cada RpcErrorCode<K> de las 18 RPC se emiten y tipan sin errores', async () => {
      const fake = createFakeRpcClient({ settings: BASE_SETTINGS });
      for (const code of ALL_DOMAIN_ERROR_CODES) {
        const triggered = await fake.triggerErrorCode(code);
        expect(triggered).toEqual({ ok: false, code });
      }
      for (const rpcName of ALL_RPC_NAMES) {
        const codes = RPC_CONTRACTS[rpcName].errorCodes;
        expect(codes.length).toBeGreaterThan(0);
        for (const code of codes) {
          const typedCode: RpcErrorCode<typeof rpcName> = code;
          expect(isDomainErrorCode(typedCode)).toBe(true);
        }
      }
    });

    describe('Ronda 2 — Cierre de H05, H07, H08 y códigos específicos de admin_update_setting', () => {
      it('H05 (Ronda 2): setForcedError está ligado por RPC y rechaza códigos fuera del catálogo de la RPC invocada', () => {
        const fake = createFakeRpcClient({
          settings: BASE_SETTINGS,
          initialActor: { userId: MERCHANT_1, role: 'merchant' },
        });
        expect(() =>
          (fake.setForcedError as unknown as (rpc: string, code: string) => void)(
            'publish_request',
            'AAL2_REQUIRED'
          )
        ).toThrow();
      });

      it('H04/Mejora Ronda 2: admin_update_setting devuelve INVALID_SETTING_KEY ante clave desconocida e INVALID_SETTING_VALUE ante valor inválido', async () => {
        const fake = createFakeRpcClient({
          settings: BASE_SETTINGS,
          initialActor: { userId: ADMIN_1, role: 'admin', aal: 'aal2' },
        });
        expect(
          await fake.admin_update_setting({
            key: 'unknown_key' as unknown as 'pilot_active',
            value: true,
          })
        ).toEqual({ ok: false, code: 'INVALID_SETTING_KEY' });

        expect(
          await fake.admin_update_setting({
            key: 'pilot_active',
            value: 1 as unknown as boolean,
          })
        ).toEqual({ ok: false, code: 'INVALID_SETTING_VALUE' });
      });

      it('H07.1 (Ronda 2): accept_offer rechaza con NOT_FOUND una oferta cuyo courierId no existe', async () => {
        const orphanOfferId = '60000000-0000-4000-8000-000000000001';
        const fake = createFakeRpcClient({
          settings: BASE_SETTINGS,
          initialActor: { userId: MERCHANT_1, role: 'merchant' },
          initialMerchants: [{ merchantId: MERCHANT_1, subscriptionStatus: 'pilot' }],
          initialRequests: [
            {
              requestId: REQ_1,
              merchantId: MERCHANT_1,
              status: 'published',
              expiresAt: '2026-09-22T16:00:00.000Z',
            },
          ],
          initialOffers: [
            {
              offerId: orphanOfferId,
              requestId: REQ_1,
              courierId: '20000000-0000-4000-8000-999999999999',
              amountArs: 1500,
              status: 'pending',
            },
          ],
        });

        expect(await fake.accept_offer({ offerId: orphanOfferId })).toEqual({
          ok: false,
          code: 'NOT_FOUND',
        });
      });

      it('H07.2 (Ronda 2): admin_verify_document devuelve NOT_FOUND (sin lanzar TypeError) si falta el courier del documento', async () => {
        const orphanDocId = '40000000-0000-4000-8000-000000000099';
        const fake = createFakeRpcClient({
          settings: BASE_SETTINGS,
          initialActor: { userId: ADMIN_1, role: 'admin', aal: 'aal2' },
          initialDocuments: [
            {
              documentId: orphanDocId,
              courierId: '20000000-0000-4000-8000-999999999999',
              kind: 'license',
              status: 'submitted',
            },
          ],
        });

        expect(
          await fake.admin_verify_document({ documentId: orphanDocId, decision: 'verified' })
        ).toEqual({
          ok: false,
          code: 'NOT_FOUND',
        });
      });

      it('H07.3 (Ronda 2): report_no_show y courier_cancel_match rechazan con INVALID_STATE_TRANSITION una solicitud matched sin acceptedOfferId válido', async () => {
        const fake = createFakeRpcClient({
          settings: BASE_SETTINGS,
          initialActor: { userId: MERCHANT_1, role: 'merchant' },
          initialMerchants: [{ merchantId: MERCHANT_1, subscriptionStatus: 'pilot' }],
          initialCouriers: [{ courierId: COURIER_1, status: 'approved', available: true }],
          initialRequests: [
            {
              requestId: REQ_1,
              merchantId: MERCHANT_1,
              status: 'matched',
              acceptedOfferId: null,
              assignedCourierId: COURIER_1,
            },
          ],
        });

        expect(await fake.report_no_show({ requestId: REQ_1, republish: true })).toEqual({
          ok: false,
          code: 'INVALID_STATE_TRANSITION',
        });

        fake.setActor({ userId: COURIER_1, role: 'courier' });
        expect(
          await fake.courier_cancel_match({ requestId: REQ_1, reason: 'Sin oferta válida' })
        ).toEqual({
          ok: false,
          code: 'INVALID_STATE_TRANSITION',
        });
      });

      it('H07.4 (Ronda 2): report_incident rechaza solicitudes draft y aplica la ventana de 24 horas posteriores a deliveredAt (INCIDENT_WINDOW_EXPIRED)', async () => {
        let currentNow = new Date('2026-09-22T15:00:00.000Z');
        const fake = createFakeRpcClient({
          settings: BASE_SETTINGS,
          now: () => currentNow,
          initialActor: { userId: MERCHANT_1, role: 'merchant' },
          initialMerchants: [{ merchantId: MERCHANT_1, subscriptionStatus: 'pilot' }],
          initialCouriers: [{ courierId: COURIER_1, status: 'approved', available: true }],
          initialRequests: [
            {
              requestId: REQ_1,
              merchantId: MERCHANT_1,
              status: 'draft',
            },
            {
              requestId: REQ_2,
              merchantId: MERCHANT_1,
              status: 'in_transit',
              assignedCourierId: COURIER_1,
            },
          ],
        });

        expect(
          await fake.report_incident({
            requestId: REQ_1,
            kind: 'other',
            description: 'Solicitud en borrador',
          })
        ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });

        fake.setActor({ userId: COURIER_1, role: 'courier' });
        expect(await fake.mark_delivered({ requestId: REQ_2 })).toEqual({
          ok: true,
          data: expect.objectContaining({ status: 'delivered' }),
        });

        // Within 24h window -> ok
        currentNow = new Date('2026-09-23T14:00:00.000Z');
        expect(
          await fake.report_incident({
            requestId: REQ_2,
            kind: 'damage',
            description: 'Dentro de las 24 horas',
          })
        ).toEqual({
          ok: true,
          data: expect.objectContaining({ status: 'open' }),
        });

        // After 24h window -> INCIDENT_WINDOW_EXPIRED
        currentNow = new Date('2026-09-23T15:00:01.000Z');
        expect(
          await fake.report_incident({
            requestId: REQ_2,
            kind: 'damage',
            description: 'Fuera de las 24 horas',
          })
        ).toEqual({ ok: false, code: 'INCIDENT_WINDOW_EXPIRED' });
      });

      it('H08 (Ronda 2): submit_offer nunca colisiona ni sobreescribe una oferta sembrada con 00000000-0000-4000-8000-000000000001', async () => {
        const seededOfferId = '00000000-0000-4000-8000-000000000001';
        const fake = createFakeRpcClient({
          settings: BASE_SETTINGS,
          initialActor: {
            userId: COURIER_2,
            role: 'courier',
            courierStatus: 'approved',
            courierAvailable: true,
          },
          initialCouriers: [
            { courierId: COURIER_1, status: 'approved', available: true },
            { courierId: COURIER_2, status: 'approved', available: true },
          ],
          initialRequests: [
            {
              requestId: REQ_1,
              merchantId: MERCHANT_1,
              status: 'published',
              expiresAt: '2026-09-22T16:00:00.000Z',
            },
          ],
          initialOffers: [
            {
              offerId: seededOfferId,
              requestId: REQ_1,
              courierId: COURIER_1,
              amountArs: 1300,
              status: 'pending',
            },
          ],
        });

        const submitted = await fake.submit_offer({
          requestId: REQ_1,
          amountArs: 1400,
          etaMinutes: 15,
        });
        expect(submitted.ok).toBe(true);
        if (submitted.ok) {
          expect(submitted.data.offerId).not.toBe(seededOfferId);
        }
        expect(fake.getOffer(seededOfferId)?.courierId).toBe(COURIER_1);
      });
    });
  });
});
