import { describe, it, expect } from 'vitest';
import { DOMAIN_ERROR_CODES, isDomainErrorCode } from './errors';
import { PLATFORM_SETTING_KEYS } from './schemas';
import {
  adminUpdateSettingInputSchema,
  publishRequestOutputSchema,
  submitOfferOutputSchema,
  takeRequestOutputSchema,
  acceptOfferOutputSchema,
  ALL_RPC_NAMES,
  RPC_CONTRACTS,
} from './rpc-contracts';
import {
  createFakeRpcClient,
  type FakePlatformSettings,
  type FakeSeedDrop,
  type FakeSeedRequest,
} from './testing/rpc-fake';

const REQ_ID = '30000000-0000-4000-8000-000000000001';
const DROP_ID = '40000000-0000-4000-8000-000000000001';

describe('T-340 / CC-022: Multi-drop contracts & domain errors', () => {
  it('CC-024 expone el contrato de alta y publicación atómica multi-drop', () => {
    expect(RPC_CONTRACTS).toHaveProperty('create_and_publish_multi_drop');
    expect(ALL_RPC_NAMES).toContain('create_and_publish_multi_drop');
  });

  it('el fake crea y publica una solicitud con drops sin poblar columnas legacy de destino', async () => {
    const fake = createFakeRpcClient({
      settings: BASE_SETTINGS,
      initialActor: MERCHANT_ACTOR,
    });

    const result = await fake.create_and_publish_multi_drop({
      requestId: REQ_ID,
      pickupZoneId: '00000000-0000-4000-8000-000000000001',
      pickupAddress: 'San Martín 100',
      pickupLat: null,
      pickupLng: null,
      fixedPriceArs: null,
      autoAssign: false,
      drops: [
        {
          dropoffZoneId: '00000000-0000-4000-8000-000000000002',
          dropoffAddress: 'Alberdi 200',
          dropoffLat: null,
          dropoffLng: null,
          recipientName: 'Juan',
          recipientPhone: '3865123456',
          recipientConsentDeclared: true as const,
          packageType: 'chico',
          recipientPaymentMethod: 'cash',
          needsChange: false as const,
          cashChangeAmount: null,
          notes: null,
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        requestId: REQ_ID,
        status: 'published',
        idempotent: false,
        dropsCount: 1,
      });
    }
    const request = fake.getRequest(REQ_ID);
    expect(request?.dropoffAddress).toBe('');
    expect(request?.recipientName).toBe('');
    expect(request?.notes).toBeNull();
  });

  it('reintenta de forma idempotente y rechaza un mismo requestId con otro payload', async () => {
    const fake = createFakeRpcClient({
      settings: BASE_SETTINGS,
      initialActor: MERCHANT_ACTOR,
    });
    const input = {
      requestId: REQ_ID,
      pickupZoneId: '00000000-0000-4000-8000-000000000001',
      pickupAddress: 'San Martín 100',
      pickupLat: null,
      pickupLng: null,
      fixedPriceArs: null,
      autoAssign: false,
      drops: [
        {
          dropoffZoneId: '00000000-0000-4000-8000-000000000002',
          dropoffAddress: 'Alberdi 200',
          dropoffLat: null,
          dropoffLng: null,
          recipientName: 'Juan',
          recipientPhone: '3865123456',
          recipientConsentDeclared: true as const,
          packageType: 'chico' as const,
          recipientPaymentMethod: 'cash' as const,
          needsChange: false as const,
          cashChangeAmount: null,
          notes: null,
        },
      ],
    };

    const first = await fake.create_and_publish_multi_drop(input);
    const retry = await fake.create_and_publish_multi_drop(input);

    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    if (first.ok && retry.ok) {
      expect(first.data.idempotent).toBe(false);
      expect(retry.data).toMatchObject({
        requestId: REQ_ID,
        status: 'published',
        idempotent: true,
        publishedAt: first.data.publishedAt,
      });
    }
    expect(fake.getRequest(REQ_ID)?.drops).toHaveLength(1);

    const conflicting = await fake.create_and_publish_multi_drop({
      ...input,
      pickupAddress: 'Otra dirección',
    });
    expect(conflicting).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('DOMAIN_ERROR_CODES contains DROP_LIMIT_EXCEEDED and publish_request contract includes it', () => {
    expect(DOMAIN_ERROR_CODES).toContain('DROP_LIMIT_EXCEEDED');
    expect(isDomainErrorCode('DROP_LIMIT_EXCEEDED')).toBe(true);
    expect(RPC_CONTRACTS.publish_request.errorCodes).toContain('DROP_LIMIT_EXCEEDED');
  });

  it('PLATFORM_SETTING_KEYS includes max_drops_per_request and adminUpdateSettingInputSchema validates it', () => {
    expect(PLATFORM_SETTING_KEYS).toContain('max_drops_per_request');

    const validSetting = adminUpdateSettingInputSchema.safeParse({
      key: 'max_drops_per_request',
      value: 5,
    });
    expect(validSetting.success).toBe(true);

    const minSetting = adminUpdateSettingInputSchema.safeParse({
      key: 'max_drops_per_request',
      value: 1,
    });
    expect(minSetting.success).toBe(true);

    const zeroSetting = adminUpdateSettingInputSchema.safeParse({
      key: 'max_drops_per_request',
      value: 0,
    });
    expect(zeroSetting.success).toBe(false);

    const decimalSetting = adminUpdateSettingInputSchema.safeParse({
      key: 'max_drops_per_request',
      value: 2.5,
    });
    expect(decimalSetting.success).toBe(false);

    const negativeSetting = adminUpdateSettingInputSchema.safeParse({
      key: 'max_drops_per_request',
      value: -1,
    });
    expect(negativeSetting.success).toBe(false);
  });

  it('publish_request includes dropsCount in output', () => {
    const validOutput = {
      requestId: REQ_ID,
      status: 'published' as const,
      publishedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      routeDistanceM: 1500,
      fixedPriceArs: null,
      autoAssign: false,
      dropsCount: 3,
    };
    expect(publishRequestOutputSchema.safeParse(validOutput).success).toBe(true);

    const missingDropsCount = {
      ...validOutput,
      dropsCount: undefined,
    };
    expect(publishRequestOutputSchema.safeParse(missingDropsCount).success).toBe(false);

    const zeroDropsCount = {
      ...validOutput,
      dropsCount: 0,
    };
    expect(publishRequestOutputSchema.safeParse(zeroDropsCount).success).toBe(false);
  });

  it('submit_offer, take_request, and accept_offer include totalAmountArs in outputs', () => {
    const submitOutput = {
      offerId: '50000000-0000-4000-8000-000000000001',
      requestId: REQ_ID,
      status: 'pending' as const,
      amountArs: 1500,
      totalAmountArs: 4500,
      createdAt: new Date().toISOString(),
    };
    expect(submitOfferOutputSchema.safeParse(submitOutput).success).toBe(true);

    const takeOutput = {
      offerId: '50000000-0000-4000-8000-000000000001',
      requestId: REQ_ID,
      amountArs: 1500,
      totalAmountArs: 4500,
      offerStatus: 'accepted' as const,
      requestStatus: 'matched' as const,
      matchedAt: new Date().toISOString(),
      idempotent: false,
    };
    expect(takeRequestOutputSchema.safeParse(takeOutput).success).toBe(true);

    const acceptOutput = {
      requestId: REQ_ID,
      acceptedOfferId: '50000000-0000-4000-8000-000000000001',
      status: 'matched' as const,
      matchedAt: new Date().toISOString(),
      idempotent: false,
      totalAmountArs: 4500,
    };
    expect(acceptOfferOutputSchema.safeParse(acceptOutput).success).toBe(true);
  });

  it('RPC_CONTRACTS defines mark_drop_delivered and mark_drop_failed', () => {
    expect('mark_drop_delivered' in RPC_CONTRACTS).toBe(true);
    expect('mark_drop_failed' in RPC_CONTRACTS).toBe(true);

    const deliveredContract = RPC_CONTRACTS.mark_drop_delivered;
    expect(deliveredContract).toBeDefined();
    expect(deliveredContract.errorCodes).toEqual(
      expect.arrayContaining([
        'UNAUTHENTICATED',
        'UNAUTHORIZED_ACTOR',
        'NOT_FOUND',
        'COURIER_SUSPENDED',
        'COURIER_NOT_APPROVED',
        'INVALID_STATE_TRANSITION',
      ])
    );

    const failedContract = RPC_CONTRACTS.mark_drop_failed;
    expect(failedContract).toBeDefined();
    expect(failedContract.errorCodes).toEqual(
      expect.arrayContaining([
        'UNAUTHENTICATED',
        'UNAUTHORIZED_ACTOR',
        'NOT_FOUND',
        'COURIER_SUSPENDED',
        'COURIER_NOT_APPROVED',
        'REASON_REQUIRED',
        'INVALID_STATE_TRANSITION',
      ])
    );
  });

  const BASE_SETTINGS: FakePlatformSettings = {
    minOfferArs: 1000,
    maxOffersPerMin: 10,
    maxRequestPublicationsPerMin: 10,
    maxIncidentsPerMin: 5,
    requestTtlMinutes: 25,
    pilotActive: true,
    pilotTermsVersion: 'v1.0',
    subscriptionGraceDays: 3,
    maxDropsPerRequest: 5,
  };

  const MERCHANT_ACTOR = {
    userId: '20000000-0000-4000-8000-000000000001',
    role: 'merchant' as const,
    consentStatus: 'active' as const,
    aal: 'aal1' as const,
    courierStatus: 'approved' as const,
    courierAvailable: true,
    merchantSubscriptionStatus: 'pilot' as const,
    merchantPaidUntil: null,
  };

  const COURIER_ACTOR = {
    userId: '10000000-0000-4000-8000-000000000001',
    role: 'courier' as const,
    consentStatus: 'active' as const,
    aal: 'aal1' as const,
    courierStatus: 'approved' as const,
    courierAvailable: true,
    merchantSubscriptionStatus: 'pilot' as const,
    merchantPaidUntil: null,
  };

  const ADMIN_ACTOR = {
    userId: '00000000-0000-4000-8000-000000000001',
    role: 'admin' as const,
    consentStatus: 'active' as const,
    aal: 'aal2' as const,
    courierStatus: 'approved' as const,
    courierAvailable: false,
    merchantSubscriptionStatus: 'pilot' as const,
    merchantPaidUntil: null,
  };

  describe('FakeRpcClient multi-drop support', () => {
    it('supports publishing requests with drops and materializes legacy requests', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: MERCHANT_ACTOR,
      });

      fake.seedRequest({
        requestId: REQ_ID,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'draft',
        pickupAddress: 'San Martín 100',
        pickupZoneName: 'Centro',
        dropoffAddress: 'Alberdi 200',
        dropoffZoneName: 'Barrio Norte',
        recipientName: 'Juan',
        recipientPhone: '+543865123456',
        recipientPaymentMethod: 'cash',
        needsChange: false,
      });

      const publishLegacy = await fake.publish_request({ requestId: REQ_ID });
      expect(publishLegacy.ok).toBe(true);
      if (publishLegacy.ok) {
        expect(publishLegacy.data.dropsCount).toBe(1);
      }
    });

    it('calculates chained Haversine route distance and handles null coordinates', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: MERCHANT_ACTOR,
      });

      const multiDropReqId = '30000000-0000-4000-8000-000000000010';
      fake.seedRequest({
        requestId: multiDropReqId,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'draft',
        pickupAddress: 'San Martín 100',
        pickupZoneName: 'Centro',
        pickupLat: -27.4333,
        pickupLng: -65.6167,
        drops: [
          {
            id: '40000000-0000-4000-8000-000000000011',
            position: 1,
            dropoffAddress: 'Alberdi 100',
            dropoffZoneName: 'Centro',
            recipientName: 'Dest 1',
            recipientPhone: '+543865111111',
            recipientPaymentMethod: 'cash',
            needsChange: false,
            dropoffLat: -27.425,
            dropoffLng: -65.61,
          },
          {
            id: '40000000-0000-4000-8000-000000000012',
            position: 2,
            dropoffAddress: 'Belgrano 200',
            dropoffZoneName: 'Centro',
            recipientName: 'Dest 2',
            recipientPhone: '+543865222222',
            recipientPaymentMethod: 'cash',
            needsChange: false,
            dropoffLat: -27.42,
            dropoffLng: -65.605,
          },
          {
            id: '40000000-0000-4000-8000-000000000013',
            position: 3,
            dropoffAddress: 'Mitre 300',
            dropoffZoneName: 'Centro',
            recipientName: 'Dest 3',
            recipientPhone: '+543865333333',
            recipientPaymentMethod: 'cash',
            needsChange: false,
            dropoffLat: -27.415,
            dropoffLng: -65.6,
          },
        ],
      });

      const res = await fake.publish_request({ requestId: multiDropReqId });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.dropsCount).toBe(3);
        expect(typeof res.data.routeDistanceM).toBe('number');
        expect((res.data.routeDistanceM ?? 0) > 0).toBe(true);
      }

      // Con una coordenada faltante en drop intermedio, routeDistanceM es null
      const nullCoordReqId = '30000000-0000-4000-8000-000000000020';
      fake.seedRequest({
        requestId: nullCoordReqId,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'draft',
        pickupAddress: 'San Martín 100',
        pickupZoneName: 'Centro',
        pickupLat: -27.4333,
        pickupLng: -65.6167,
        drops: [
          {
            id: '40000000-0000-4000-8000-000000000021',
            position: 1,
            dropoffAddress: 'Alberdi 100',
            dropoffZoneName: 'Centro',
            recipientName: 'Dest 1',
            recipientPhone: '+543865111111',
            recipientPaymentMethod: 'cash',
            needsChange: false,
            dropoffLat: -27.425,
            dropoffLng: -65.61,
          },
          {
            id: '40000000-0000-4000-8000-000000000022',
            position: 2,
            dropoffAddress: 'Belgrano 200',
            dropoffZoneName: 'Centro',
            recipientName: 'Dest 2',
            recipientPhone: '+543865222222',
            recipientPaymentMethod: 'cash',
            needsChange: false,
            dropoffLat: null,
            dropoffLng: null,
          },
        ],
      });

      const resNullCoord = await fake.publish_request({ requestId: nullCoordReqId });
      expect(resNullCoord.ok).toBe(true);
      if (resNullCoord.ok) {
        expect(resNullCoord.data.routeDistanceM).toBeNull();
      }
    });

    it('validates drop integrity and constraints on publish_request', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: MERCHANT_ACTOR,
      });

      const testValidation = async (reqPatch: Partial<FakeSeedRequest>, expectedCode: string) => {
        const id = '30000000-0000-4000-8000-000000000099';
        fake.seedRequest({
          requestId: id,
          merchantId: MERCHANT_ACTOR.userId,
          status: 'draft',
          pickupAddress: 'San Martín 100',
          pickupZoneName: 'Centro',
          pickupLat: -27.4333,
          pickupLng: -65.6167,
          drops: [
            {
              id: '40000000-0000-4000-8000-000000000091',
              position: 1,
              dropoffAddress: 'Alberdi 100',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 1',
              recipientPhone: '+543865111111',
              recipientPaymentMethod: 'cash',
              needsChange: false,
              cashChangeAmount: null,
              dropoffLat: -27.425,
              dropoffLng: -65.61,
            },
          ],
          ...reqPatch,
        });
        const res = await fake.publish_request({ requestId: id });
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.code).toBe(expectedCode);
        }
      };

      // 1. Posiciones no consecutivas
      await testValidation(
        {
          drops: [
            {
              id: '40000000-0000-4000-8000-000000000091',
              position: 1,
              dropoffAddress: 'Alberdi 100',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 1',
              recipientPhone: '+543865111111',
              recipientPaymentMethod: 'cash',
              needsChange: false,
            },
            {
              id: '40000000-0000-4000-8000-000000000092',
              position: 3,
              dropoffAddress: 'Alberdi 200',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 2',
              recipientPhone: '+543865222222',
              recipientPaymentMethod: 'cash',
              needsChange: false,
            },
          ],
        },
        'VALIDATION_ERROR'
      );

      // 2. Drop con coordenadas fuera de Aguilares
      await testValidation(
        {
          drops: [
            {
              id: '40000000-0000-4000-8000-000000000091',
              position: 1,
              dropoffAddress: 'Obelisco',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 1',
              recipientPhone: '+543865111111',
              recipientPaymentMethod: 'cash',
              needsChange: false,
              dropoffLat: -34.6037,
              dropoffLng: -58.3816,
            },
          ],
        },
        'OUT_OF_BOUNDS_AGUILARES'
      );

      // 3. Pickup con coordenadas fuera de Aguilares
      await testValidation(
        {
          pickupLat: -34.6037,
          pickupLng: -58.3816,
        },
        'OUT_OF_BOUNDS_AGUILARES'
      );

      // 4. Drop con campos requeridos vacíos
      await testValidation(
        {
          drops: [
            {
              id: '40000000-0000-4000-8000-000000000091',
              position: 1,
              dropoffAddress: '',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 1',
              recipientPhone: '+543865111111',
              recipientPaymentMethod: 'cash',
              needsChange: false,
            },
          ],
        },
        'MISSING_REQUIRED_FIELDS'
      );

      // 5. Array de drops vacío sin datos legacy
      await testValidation(
        {
          drops: [],
          dropoffAddress: '',
          recipientName: '',
          recipientPhone: '',
        },
        'MISSING_REQUIRED_FIELDS'
      );

      // 6. Medio de pago no-cash con needsChange: true
      await testValidation(
        {
          drops: [
            {
              id: '40000000-0000-4000-8000-000000000091',
              position: 1,
              dropoffAddress: 'Alberdi 100',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 1',
              recipientPhone: '+543865111111',
              recipientPaymentMethod: 'transfer',
              needsChange: true,
            },
          ],
        },
        'VALIDATION_ERROR'
      );

      // 7. Cash con needsChange: true y cashChangeAmount null
      await testValidation(
        {
          drops: [
            {
              id: '40000000-0000-4000-8000-000000000091',
              position: 1,
              dropoffAddress: 'Alberdi 100',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 1',
              recipientPhone: '+543865111111',
              recipientPaymentMethod: 'cash',
              needsChange: true,
              cashChangeAmount: null,
            },
          ],
        },
        'VALIDATION_ERROR'
      );

      // 8. Cash con needsChange: true y cashChangeAmount <= 0
      await testValidation(
        {
          drops: [
            {
              id: '40000000-0000-4000-8000-000000000091',
              position: 1,
              dropoffAddress: 'Alberdi 100',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 1',
              recipientPhone: '+543865111111',
              recipientPaymentMethod: 'cash',
              needsChange: true,
              cashChangeAmount: 0,
            },
          ],
        },
        'VALIDATION_ERROR'
      );

      // 9. Cash con needsChange: false pero con cashChangeAmount presente
      await testValidation(
        {
          drops: [
            {
              id: '40000000-0000-4000-8000-000000000091',
              position: 1,
              dropoffAddress: 'Alberdi 100',
              dropoffZoneName: 'Centro',
              recipientName: 'Dest 1',
              recipientPhone: '+543865111111',
              recipientPaymentMethod: 'cash',
              needsChange: false,
              cashChangeAmount: 5000,
            },
          ],
        },
        'VALIDATION_ERROR'
      );

      // 10. Precio fijo inferior al piso mínimo
      await testValidation({ fixedPriceArs: 500 }, 'OFFER_BELOW_MINIMUM');
    });

    it('rejects publishing when drops exceed max_drops_per_request with DROP_LIMIT_EXCEEDED', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: MERCHANT_ACTOR,
      });

      const multiDropReqId = '30000000-0000-4000-8000-000000000002';
      const drops: FakeSeedDrop[] = Array.from({ length: 6 }, (_, i) => ({
        id: `40000000-0000-4000-8000-00000000000${i + 1}`,
        position: i + 1,
        dropoffAddress: `Calle ${i + 1}`,
        dropoffZoneName: 'Centro',
        recipientName: `Persona ${i + 1}`,
        recipientPhone: '+543865123456',
        recipientPaymentMethod: 'cash',
        needsChange: false,
      }));

      fake.seedRequest({
        requestId: multiDropReqId,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'draft',
        pickupAddress: 'San Martín 100',
        pickupZoneName: 'Centro',
        drops,
      });

      const result = await fake.publish_request({ requestId: multiDropReqId });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('DROP_LIMIT_EXCEEDED');
      }
    });

    it('admin_update_setting dynamically configures max_drops_per_request and affects publish_request', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: ADMIN_ACTOR,
      });

      const updateRes = await fake.admin_update_setting({
        key: 'max_drops_per_request',
        value: 2,
      });
      expect(updateRes.ok).toBe(true);
      expect(fake.getSettings().maxDropsPerRequest).toBe(2);

      fake.setActor(MERCHANT_ACTOR);
      const reqId = '30000000-0000-4000-8000-000000000077';
      const drops: FakeSeedDrop[] = Array.from({ length: 3 }, (_, i) => ({
        id: `40000000-0000-4000-8000-00000000007${i + 1}`,
        position: i + 1,
        dropoffAddress: `Calle ${i + 1}`,
        dropoffZoneName: 'Centro',
        recipientName: `Persona ${i + 1}`,
        recipientPhone: '+543865123456',
        recipientPaymentMethod: 'cash',
        needsChange: false,
      }));

      fake.seedRequest({
        requestId: reqId,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'draft',
        pickupAddress: 'San Martín 100',
        pickupZoneName: 'Centro',
        drops,
      });

      const publishRes = await fake.publish_request({ requestId: reqId });
      expect(publishRes.ok).toBe(false);
      if (!publishRes.ok) {
        expect(publishRes.code).toBe('DROP_LIMIT_EXCEEDED');
      }
    });

    it('get_trip_details supports multi-drop, enforces actor and state authorization', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: MERCHANT_ACTOR,
      });

      const tripReqId = '30000000-0000-4000-8000-000000000088';
      const offerId = '50000000-0000-4000-8000-000000000088';

      // 1. Solicitud no existente
      const notFoundRes = await fake.get_trip_details({
        requestId: '30000000-0000-4000-8000-000000000000',
      });
      expect(notFoundRes.ok).toBe(false);
      if (!notFoundRes.ok) expect(notFoundRes.code).toBe('NOT_FOUND');

      // 2. Solicitud en estado draft
      fake.seedRequest({
        requestId: tripReqId,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'draft',
        pickupAddress: 'San Martín 100',
        pickupZoneName: 'Centro',
      });
      const draftRes = await fake.get_trip_details({ requestId: tripReqId });
      expect(draftRes.ok).toBe(false);
      if (!draftRes.ok) expect(draftRes.code).toBe('INVALID_STATE_TRANSITION');

      // 3. Solicitud matched sin oferta aceptada
      fake.seedRequest({
        requestId: tripReqId,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'matched',
        pickupAddress: 'San Martín 100',
        pickupZoneName: 'Centro',
      });
      const noOfferRes = await fake.get_trip_details({ requestId: tripReqId });
      expect(noOfferRes.ok).toBe(false);
      if (!noOfferRes.ok) expect(noOfferRes.code).toBe('INVALID_STATE_TRANSITION');

      // Seed de comercio, repartidor y oferta aceptada
      fake.seedMerchant({
        merchantId: MERCHANT_ACTOR.userId,
        businessName: 'Kiosco Central',
        phone: '+543865111111',
        subscriptionStatus: 'active',
      });
      fake.seedCourier({
        courierId: COURIER_ACTOR.userId,
        displayName: 'Carlos Courier',
        phone: '+543865222222',
        vehicleType: 'moto',
        vehiclePlate: 'AB123CD',
        status: 'approved',
        available: true,
      });
      fake.seedOffer({
        offerId,
        requestId: tripReqId,
        courierId: COURIER_ACTOR.userId,
        amountArs: 1500,
        status: 'accepted',
      });

      fake.seedRequest({
        requestId: tripReqId,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'matched',
        acceptedOfferId: offerId,
        assignedCourierId: COURIER_ACTOR.userId,
        pickupAddress: 'San Martín 100',
        pickupZoneName: 'Centro',
        drops: [
          {
            id: '40000000-0000-4000-8000-000000000082',
            position: 2,
            dropoffAddress: 'Drop 2',
            dropoffZoneName: 'Centro',
            recipientName: 'Rec 2',
            recipientPhone: '+543865222222',
            recipientPaymentMethod: 'cash',
            needsChange: false,
            notes: 'Segundo destino',
          },
          {
            id: '40000000-0000-4000-8000-000000000081',
            position: 1,
            dropoffAddress: 'Drop 1',
            dropoffZoneName: 'Centro',
            recipientName: 'Rec 1',
            recipientPhone: '+543865111111',
            recipientPaymentMethod: 'cash',
            needsChange: false,
            notes: 'Primer destino',
          },
        ],
      });

      // 4. Actor ajeno no autorizado (otro comercio)
      fake.setActor({
        userId: '20000000-0000-4000-8000-000000000099',
        role: 'merchant',
      });
      const unauthMerch = await fake.get_trip_details({ requestId: tripReqId });
      expect(unauthMerch.ok).toBe(false);
      if (!unauthMerch.ok) expect(unauthMerch.code).toBe('UNAUTHORIZED_ACTOR');

      // 5. Actor ajeno no autorizado (otro repartidor)
      fake.setActor({
        userId: '10000000-0000-4000-8000-000000000099',
        role: 'courier',
      });
      const unauthCourier = await fake.get_trip_details({ requestId: tripReqId });
      expect(unauthCourier.ok).toBe(false);
      if (!unauthCourier.ok) expect(unauthCourier.code).toBe('UNAUTHORIZED_ACTOR');

      // 6. Comercio dueño: recibe drops ordenados por position
      fake.setActor(MERCHANT_ACTOR);
      const merchDetails = await fake.get_trip_details({ requestId: tripReqId });
      expect(merchDetails.ok).toBe(true);
      if (merchDetails.ok) {
        expect(merchDetails.data.dropsCount).toBe(2);
        const drop0 = merchDetails.data.drops[0];
        const drop1 = merchDetails.data.drops[1];
        expect(drop0?.position).toBe(1);
        expect(drop1?.position).toBe(2);
        expect(drop0?.deliveryNotes).toBe('Primer destino');
        expect(drop1?.deliveryNotes).toBe('Segundo destino');
        expect(merchDetails.data.deliveryNotes).toBe('Primer destino');
      }

      // 7. Repartidor aceptado: recibe proyección autorizada
      fake.setActor(COURIER_ACTOR);
      const courierDetails = await fake.get_trip_details({ requestId: tripReqId });
      expect(courierDetails.ok).toBe(true);
      if (courierDetails.ok) {
        expect(courierDetails.data.dropsCount).toBe(2);
        expect(courierDetails.data.courierName).toBe('Carlos Courier');
      }
    });

    it('mark_drop_delivered and mark_drop_failed validate eligibility, actors, transitions, and reasons', async () => {
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS,
        initialActor: COURIER_ACTOR,
      });

      const multiReqId = '30000000-0000-4000-8000-000000000003';
      const drop1Id = '40000000-0000-4000-8000-000000000011';
      const drop2Id = '40000000-0000-4000-8000-000000000012';

      fake.seedRequest({
        requestId: multiReqId,
        merchantId: MERCHANT_ACTOR.userId,
        status: 'in_transit',
        assignedCourierId: COURIER_ACTOR.userId,
        drops: [
          { id: drop1Id, position: 1, status: 'pending' },
          { id: drop2Id, position: 2, status: 'pending' },
        ],
      });

      // 1. Repartidor no aprobado
      fake.setActor({ courierStatus: 'pending' });
      const delivNotAppr = await fake.mark_drop_delivered({ dropId: drop1Id });
      expect(delivNotAppr.ok).toBe(false);
      if (!delivNotAppr.ok) expect(delivNotAppr.code).toBe('COURIER_NOT_APPROVED');

      const failNotAppr = await fake.mark_drop_failed({ dropId: drop1Id, reason: 'Test' });
      expect(failNotAppr.ok).toBe(false);
      if (!failNotAppr.ok) expect(failNotAppr.code).toBe('COURIER_NOT_APPROVED');

      // 2. Repartidor suspendido
      fake.setActor({ courierStatus: 'suspended' });
      const delivSusp = await fake.mark_drop_delivered({ dropId: drop1Id });
      expect(delivSusp.ok).toBe(false);
      if (!delivSusp.ok) expect(delivSusp.code).toBe('COURIER_SUSPENDED');

      const failSusp = await fake.mark_drop_failed({ dropId: drop1Id, reason: 'Test' });
      expect(failSusp.ok).toBe(false);
      if (!failSusp.ok) expect(failSusp.code).toBe('COURIER_SUSPENDED');

      fake.setActor(COURIER_ACTOR);

      // 3. Drop inexistente
      const delivNotFound = await fake.mark_drop_delivered({
        dropId: '40000000-0000-4000-8000-000000000000',
      });
      expect(delivNotFound.ok).toBe(false);
      if (!delivNotFound.ok) expect(delivNotFound.code).toBe('NOT_FOUND');

      const failNotFound = await fake.mark_drop_failed({
        dropId: '40000000-0000-4000-8000-000000000000',
        reason: 'Test',
      });
      expect(failNotFound.ok).toBe(false);
      if (!failNotFound.ok) expect(failNotFound.code).toBe('NOT_FOUND');

      // 4. Razón vacía en mark_drop_failed
      const failEmptyReason = await fake.mark_drop_failed({ dropId: drop1Id, reason: '   ' });
      expect(failEmptyReason.ok).toBe(false);
      if (!failEmptyReason.ok) expect(failEmptyReason.code).toBe('REASON_REQUIRED');

      // 5. Repartidor ajeno
      fake.setActor({ userId: '10000000-0000-4000-8000-000000000099' });
      const delivUnauth = await fake.mark_drop_delivered({ dropId: drop1Id });
      expect(delivUnauth.ok).toBe(false);
      if (!delivUnauth.ok) expect(delivUnauth.code).toBe('UNAUTHORIZED_ACTOR');

      const failUnauth = await fake.mark_drop_failed({ dropId: drop1Id, reason: 'Test' });
      expect(failUnauth.ok).toBe(false);
      if (!failUnauth.ok) expect(failUnauth.code).toBe('UNAUTHORIZED_ACTOR');

      fake.setActor(COURIER_ACTOR);

      // 6. Entrega exitosa del drop 1
      const res1 = await fake.mark_drop_delivered({ dropId: drop1Id });
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.data.status).toBe('delivered');
        expect(res1.data.requestStatus).toBe('in_transit');
      }

      // Reintento idempotente del drop 1
      const res1Retry = await fake.mark_drop_delivered({ dropId: drop1Id });
      expect(res1Retry.ok).toBe(true);
      if (res1Retry.ok) {
        expect(res1Retry.data.idempotent).toBe(true);
      }

      // No se puede marcar fallido un drop ya entregado
      const failAfterDeliv = await fake.mark_drop_failed({
        dropId: drop1Id,
        reason: 'Ya fue entregado',
      });
      expect(failAfterDeliv.ok).toBe(false);
      if (!failAfterDeliv.ok) expect(failAfterDeliv.code).toBe('INVALID_STATE_TRANSITION');

      // 7. Marcar fallido drop 2 -> último drop cierra el request a delivered
      const res2 = await fake.mark_drop_failed({
        dropId: drop2Id,
        reason: 'Destinatario no atendió',
      });
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.data.status).toBe('failed');
        expect(res2.data.requestStatus).toBe('delivered');
      }

      // Reintento idempotente del drop 2 fallido
      const res2Retry = await fake.mark_drop_failed({
        dropId: drop2Id,
        reason: 'Reintento',
      });
      expect(res2Retry.ok).toBe(true);
      if (res2Retry.ok) {
        expect(res2Retry.data.idempotent).toBe(true);
      }

      // No se puede marcar entregado un drop ya fallido
      const delivAfterFail = await fake.mark_drop_delivered({ dropId: drop2Id });
      expect(delivAfterFail.ok).toBe(false);
      if (!delivAfterFail.ok) expect(delivAfterFail.code).toBe('INVALID_STATE_TRANSITION');

      // Direct mark_delivered on multi-drop (dropsCount > 1) is rejected
      const directMark = await fake.mark_delivered({ requestId: multiReqId });
      expect(directMark.ok).toBe(false);
      if (!directMark.ok) {
        expect(directMark.code).toBe('INVALID_STATE_TRANSITION');
      }
    });
  });
});
