import { describe, it, expect } from 'vitest';
import { DOMAIN_ERROR_CODES, isDomainErrorCode } from './errors';
import { PLATFORM_SETTING_KEYS } from './schemas';
import {
  adminUpdateSettingInputSchema,
  publishRequestOutputSchema,
  submitOfferOutputSchema,
  takeRequestOutputSchema,
  acceptOfferOutputSchema,
  RPC_CONTRACTS,
} from './rpc-contracts';

const REQ_ID = '30000000-0000-4000-8000-000000000001';
const DROP_ID = '40000000-0000-4000-8000-000000000001';

describe('T-340 / CC-022: Multi-drop contracts & domain errors', () => {
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

    const deliveredContract = (RPC_CONTRACTS as Record<string, any>).mark_drop_delivered;
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

    const failedContract = (RPC_CONTRACTS as Record<string, any>).mark_drop_failed;
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

const BASE_SETTINGS = {
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

  describe('FakeRpcClient multi-drop support', () => {
    it('supports publishing requests with drops and materializes legacy requests', async () => {
      const { createFakeRpcClient } = await import('./testing/rpc-fake');
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS as any,
        initialActor: {
          userId: '20000000-0000-4000-8000-000000000001',
          role: 'merchant',
          consentStatus: 'active',
          aal: 'aal1',
          courierStatus: 'approved',
          courierAvailable: true,
          merchantSubscriptionStatus: 'pilot',
          merchantPaidUntil: null,
        },
      });

      // Legacy request without drops: publish_request materializes 1 drop
      fake.seedRequest({
        requestId: REQ_ID,
        merchantId: '20000000-0000-4000-8000-000000000001',
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
        expect((publishLegacy.data as any).dropsCount).toBe(1);
      }
    });

    it('rejects publishing when drops exceed max_drops_per_request with DROP_LIMIT_EXCEEDED', async () => {
      const { createFakeRpcClient } = await import('./testing/rpc-fake');
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS as any,
        initialActor: {
          userId: '20000000-0000-4000-8000-000000000001',
          role: 'merchant',
          consentStatus: 'active',
          aal: 'aal1',
          courierStatus: 'approved',
          courierAvailable: true,
          merchantSubscriptionStatus: 'pilot',
          merchantPaidUntil: null,
        },
      });

      const multiDropReqId = '30000000-0000-4000-8000-000000000002';
      // 6 drops when default limit is 5
      const drops = Array.from({ length: 6 }, (_, i) => ({
        id: `40000000-0000-4000-8000-00000000000${i + 1}`,
        position: i + 1,
        dropoffAddress: `Calle ${i + 1}`,
        dropoffZoneName: 'Centro',
        recipientName: `Persona ${i + 1}`,
        recipientPhone: '+543865123456',
        recipientPaymentMethod: 'cash' as const,
        needsChange: false,
      }));

      (fake as any).seedRequest({
        requestId: multiDropReqId,
        merchantId: '20000000-0000-4000-8000-000000000001',
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

    it('marks drops delivered / failed and auto-closes request when last drop finishes', async () => {
      const { createFakeRpcClient } = await import('./testing/rpc-fake');
      const courierId = '10000000-0000-4000-8000-000000000001';
      const fake = createFakeRpcClient({
        settings: BASE_SETTINGS as any,
        initialActor: {
          userId: courierId,
          role: 'courier',
          consentStatus: 'active',
          aal: 'aal1',
          courierStatus: 'approved',
          courierAvailable: true,
          merchantSubscriptionStatus: 'pilot',
          merchantPaidUntil: null,
        },
      });

      const multiReqId = '30000000-0000-4000-8000-000000000003';
      const drop1Id = '40000000-0000-4000-8000-000000000011';
      const drop2Id = '40000000-0000-4000-8000-000000000012';

      (fake as any).seedRequest({
        requestId: multiReqId,
        merchantId: '20000000-0000-4000-8000-000000000001',
        status: 'in_transit',
        assignedCourierId: courierId,
        drops: [
          { id: drop1Id, position: 1, status: 'pending' },
          { id: drop2Id, position: 2, status: 'pending' },
        ],
      });

      // Mark drop 1 delivered
      const res1 = await (fake as any).mark_drop_delivered({ dropId: drop1Id });
      expect(res1.ok).toBe(true);
      expect(res1.data.status).toBe('delivered');
      expect(res1.data.requestStatus).toBe('in_transit');

      // Idempotent retry on drop 1
      const res1Retry = await (fake as any).mark_drop_delivered({ dropId: drop1Id });
      expect(res1Retry.ok).toBe(true);
      expect(res1Retry.data.idempotent).toBe(true);

      // Mark drop 2 failed with reason -> last drop closes request to delivered!
      const res2 = await (fake as any).mark_drop_failed({
        dropId: drop2Id,
        reason: 'Destinatario no atendió',
      });
      expect(res2.ok).toBe(true);
      expect(res2.data.status).toBe('failed');
      expect(res2.data.requestStatus).toBe('delivered');

      // Direct mark_delivered on multi-drop (dropsCount > 1) is rejected
      const directMark = await fake.mark_delivered({ requestId: multiReqId });
      expect(directMark.ok).toBe(false);
      if (!directMark.ok) {
        expect(directMark.code).toBe('INVALID_STATE_TRANSITION');
      }
    });
  });
});
