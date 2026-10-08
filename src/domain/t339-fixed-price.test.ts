import { describe, it, expect } from 'vitest';
import { DOMAIN_ERROR_CODES, isDomainErrorCode } from './errors';
import { RPC_CONTRACTS } from './rpc-contracts';
import { createFakeRpcClient } from './testing/rpc-fake';

const MERCHANT_ID = '20000000-0000-4000-8000-000000000001';
const COURIER_1_ID = '10000000-0000-4000-8000-000000000001';
const COURIER_2_ID = '10000000-0000-4000-8000-000000000002';
const REQ_OPEN_ID = '30000000-0000-4000-8000-000000000001';
const REQ_FIXED_MANUAL_ID = '30000000-0000-4000-8000-000000000002';
const REQ_FIXED_AUTO_ID = '30000000-0000-4000-8000-000000000003';
const REQ_DRAFT_ID = '30000000-0000-4000-8000-000000000004';

describe('T-339 / CC-021: Fixed price and take_request contracts', () => {
  it('DOMAIN_ERROR_CODES contains FIXED_PRICE_REQUEST and NO_FIXED_PRICE', () => {
    expect(DOMAIN_ERROR_CODES).toContain('FIXED_PRICE_REQUEST');
    expect(DOMAIN_ERROR_CODES).toContain('NO_FIXED_PRICE');
    expect(isDomainErrorCode('FIXED_PRICE_REQUEST')).toBe(true);
    expect(isDomainErrorCode('NO_FIXED_PRICE')).toBe(true);
  });

  it('RPC_CONTRACTS.publish_request outputSchema includes fixedPriceArs and autoAssign', () => {
    const contract = RPC_CONTRACTS.publish_request;
    expect(contract.errorCodes).toContain('OFFER_BELOW_MINIMUM');

    const validOutput = {
      requestId: REQ_FIXED_AUTO_ID,
      status: 'published' as const,
      publishedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      routeDistanceM: 1500,
      fixedPriceArs: 1500,
      autoAssign: true,
    };
    expect(contract.outputSchema.safeParse(validOutput).success).toBe(true);

    const validOutputNullPrice = {
      ...validOutput,
      fixedPriceArs: null,
      autoAssign: false,
    };
    expect(contract.outputSchema.safeParse(validOutputNullPrice).success).toBe(true);
  });

  it('RPC_CONTRACTS.submit_offer errorCodes includes FIXED_PRICE_REQUEST', () => {
    expect(RPC_CONTRACTS.submit_offer.errorCodes).toContain('FIXED_PRICE_REQUEST');
  });

  it('RPC_CONTRACTS.take_request exists and conforms to CC-021 schema and errorCodes', () => {
    expect('take_request' in RPC_CONTRACTS).toBe(true);
    const contract = (RPC_CONTRACTS as Record<string, any>)['take_request'];
    expect(contract).toBeDefined();

    expect(contract.errorCodes).toEqual(
      expect.arrayContaining([
        'UNAUTHENTICATED',
        'UNAUTHORIZED_ACTOR',
        'NOT_FOUND',
        'COURIER_SUSPENDED',
        'COURIER_NOT_APPROVED',
        'COURIER_UNAVAILABLE',
        'VALIDATION_ERROR',
        'ALREADY_MATCHED',
        'REQUEST_EXPIRED',
        'INVALID_STATE_TRANSITION',
        'NO_FIXED_PRICE',
        'OFFER_BELOW_MINIMUM',
        'DUPLICATE_ACTIVE_OFFER',
        'RATE_LIMITED',
        'INTERNAL_ERROR',
      ])
    );
  });
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
};

describe('T-339 / CC-021: rpc-fake behavior for fixed price requests and take_request', () => {
  function setupFake() {
    return createFakeRpcClient({
      settings: BASE_SETTINGS,
      initialActor: {
        userId: COURIER_1_ID,
        role: 'courier',
        consentStatus: 'active',
        aal: 'aal1',
        courierStatus: 'approved',
        courierAvailable: true,
        merchantSubscriptionStatus: 'pilot',
        merchantPaidUntil: null,
      },
      initialMerchants: [
        {
          merchantId: MERCHANT_ID,
          subscriptionStatus: 'pilot',
        },
      ],
      initialCouriers: [
        {
          courierId: COURIER_1_ID,
          status: 'approved',
          available: true,
        },
        {
          courierId: COURIER_2_ID,
          status: 'approved',
          available: true,
        },
      ],
      initialRequests: [
        {
          requestId: REQ_OPEN_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-22T16:00:00.000Z',
        },
        {
          requestId: REQ_FIXED_MANUAL_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-22T16:00:00.000Z',
          fixedPriceArs: 1500,
          autoAssign: false,
        },
        {
          requestId: REQ_FIXED_AUTO_ID,
          merchantId: MERCHANT_ID,
          status: 'published',
          expiresAt: '2026-09-22T16:00:00.000Z',
          fixedPriceArs: 1500,
          autoAssign: true,
        },
        {
          requestId: REQ_DRAFT_ID,
          merchantId: MERCHANT_ID,
          status: 'draft',
          fixedPriceArs: 1500,
          autoAssign: true,
        },
      ],
    });
  }

  describe('publish_request floor validation', () => {
    it('rejects publishing when fixedPriceArs is below minOfferArs', async () => {
      const fake = setupFake();
      fake.setActor({ userId: MERCHANT_ID, role: 'merchant' });
      fake.seedRequest({
        requestId: '30000000-0000-4000-8000-000000000099',
        merchantId: MERCHANT_ID,
        status: 'draft',
        fixedPriceArs: 900,
        autoAssign: true,
      });

      const res = await fake.publish_request({
        requestId: '30000000-0000-4000-8000-000000000099',
      });
      expect(res).toEqual({
        ok: false,
        code: 'OFFER_BELOW_MINIMUM',
      });
    });

    it('publishes successfully with fixedPriceArs >= minOfferArs and returns fixedPriceArs and autoAssign', async () => {
      const fake = setupFake();
      fake.setActor({ userId: MERCHANT_ID, role: 'merchant' });

      const res = await fake.publish_request({
        requestId: REQ_DRAFT_ID,
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.fixedPriceArs).toBe(1500);
        expect(res.data.autoAssign).toBe(true);
      }
    });
  });

  describe('submit_offer precedence and fixed price rejection', () => {
    it('rejects submit_offer on fixed price requests with FIXED_PRICE_REQUEST', async () => {
      const fake = setupFake();
      const res = await fake.submit_offer({
        requestId: REQ_FIXED_AUTO_ID,
        amountArs: 1500,
        etaMinutes: 15,
      });
      expect(res).toEqual({
        ok: false,
        code: 'FIXED_PRICE_REQUEST',
      });
    });

    it('new precedence: REQUEST_EXPIRED before RATE_LIMITED when request is expired', async () => {
      const fake = setupFake();
      const expiredReqId = '30000000-0000-4000-8000-000000000088';
      fake.seedRequest({
        requestId: expiredReqId,
        merchantId: MERCHANT_ID,
        status: 'published',
        expiresAt: '2026-09-22T14:00:00.000Z',
      });

      // Exceed rate limit on another valid request
      for (let i = 0; i < 10; i++) {
        await fake.submit_offer({
          requestId: REQ_OPEN_ID,
          amountArs: 1200 + i * 10,
          etaMinutes: 10,
        });
      }

      // Now attempt on expired request: should return REQUEST_EXPIRED, not RATE_LIMITED
      const res = await fake.submit_offer({
        requestId: expiredReqId,
        amountArs: 1500,
        etaMinutes: 10,
      });
      expect(res).toEqual({
        ok: false,
        code: 'REQUEST_EXPIRED',
      });
    });
  });

  describe('take_request behavior and rules', () => {
    it('rejects take_request on requests without fixed price with NO_FIXED_PRICE', async () => {
      const fake = setupFake();
      const res = await fake.take_request({
        requestId: REQ_OPEN_ID,
        etaMinutes: 15,
      });
      expect(res).toEqual({
        ok: false,
        code: 'NO_FIXED_PRICE',
      });
    });

    it('enforces CC-007 consent gate: pending or reconsent_required returns UNAUTHORIZED_ACTOR with zero side effects', async () => {
      const fake = setupFake();
      fake.setActor({ consentStatus: 'pending' });

      const res = await fake.take_request({
        requestId: REQ_FIXED_AUTO_ID,
        etaMinutes: 15,
      });
      expect(res).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });

      const req = fake.getRequest(REQ_FIXED_AUTO_ID);
      expect(req?.status).toBe('published');
      expect(req?.acceptedOfferId).toBeNull();
    });

    it('rejects non-courier or unauthenticated actors', async () => {
      const fake = setupFake();
      fake.setActor({ role: 'merchant' });

      const res = await fake.take_request({
        requestId: REQ_FIXED_AUTO_ID,
        etaMinutes: 15,
      });
      expect(res).toEqual({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });
    });

    it('rejects when courier is not approved, suspended, or unavailable', async () => {
      const fake = setupFake();
      fake.setActor({ courierAvailable: false });

      const res = await fake.take_request({
        requestId: REQ_FIXED_AUTO_ID,
        etaMinutes: 15,
      });
      expect(res).toEqual({
        ok: false,
        code: 'COURIER_UNAVAILABLE',
      });
    });

    it('rejects if platform min_offer_ars raised above fixed price', async () => {
      const fake = setupFake();
      fake.setMinOfferArs(2000); // fixed is 1500

      const res = await fake.take_request({
        requestId: REQ_FIXED_AUTO_ID,
        etaMinutes: 15,
      });
      expect(res).toEqual({
        ok: false,
        code: 'OFFER_BELOW_MINIMUM',
      });
    });

    describe('auto_assign = true (instant match)', () => {
      it('atomically matches the request and returns offerStatus accepted, requestStatus matched', async () => {
        const fake = setupFake();
        const res = await fake.take_request({
          requestId: REQ_FIXED_AUTO_ID,
          etaMinutes: 20,
        });

        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.data.offerStatus).toBe('accepted');
          expect(res.data.requestStatus).toBe('matched');
          expect(res.data.amountArs).toBe(1500);
          expect(res.data.idempotent).toBe(false);
          expect(res.data.matchedAt).toBeDefined();

          const req = fake.getRequest(REQ_FIXED_AUTO_ID);
          expect(req?.status).toBe('matched');
          expect(req?.acceptedOfferId).toBe(res.data.offerId);
          expect(req?.assignedCourierId).toBe(COURIER_1_ID);
        }
      });

      it('idempotency: retrying take_request by the winning courier returns idempotent: true and same offerId', async () => {
        const fake = setupFake();
        const first = await fake.take_request({
          requestId: REQ_FIXED_AUTO_ID,
          etaMinutes: 20,
        });
        expect(first.ok).toBe(true);

        const retry = await fake.take_request({
          requestId: REQ_FIXED_AUTO_ID,
          etaMinutes: 20,
        });
        expect(retry.ok).toBe(true);
        if (first.ok && retry.ok) {
          expect(retry.data.idempotent).toBe(true);
          expect(retry.data.offerId).toBe(first.data.offerId);
          expect(retry.data.offerStatus).toBe('accepted');
          expect(retry.data.requestStatus).toBe('matched');
        }
      });

      it('returns ALREADY_MATCHED if another courier attempts to take a matched request', async () => {
        const fake = setupFake();
        await fake.take_request({
          requestId: REQ_FIXED_AUTO_ID,
          etaMinutes: 20,
        });

        // Switch to Courier 2
        fake.setActor({ userId: COURIER_2_ID });
        const res = await fake.take_request({
          requestId: REQ_FIXED_AUTO_ID,
          etaMinutes: 15,
        });
        expect(res).toEqual({
          ok: false,
          code: 'ALREADY_MATCHED',
        });
      });
    });

    describe('auto_assign = false (merchant chooses)', () => {
      it('creates pending offer, request remains published, returns offerStatus pending', async () => {
        const fake = setupFake();
        const res = await fake.take_request({
          requestId: REQ_FIXED_MANUAL_ID,
          etaMinutes: 25,
        });

        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.data.offerStatus).toBe('pending');
          expect(res.data.requestStatus).toBe('published');
          expect(res.data.amountArs).toBe(1500);
          expect(res.data.idempotent).toBe(false);

          const req = fake.getRequest(REQ_FIXED_MANUAL_ID);
          expect(req?.status).toBe('published');
          expect(req?.acceptedOfferId).toBeNull();
        }
      });

      it('idempotency: retry by the same courier returns idempotent: true with same pending offer', async () => {
        const fake = setupFake();
        const first = await fake.take_request({
          requestId: REQ_FIXED_MANUAL_ID,
          etaMinutes: 25,
        });
        expect(first.ok).toBe(true);

        const retry = await fake.take_request({
          requestId: REQ_FIXED_MANUAL_ID,
          etaMinutes: 25,
        });
        expect(retry.ok).toBe(true);
        if (first.ok && retry.ok) {
          expect(retry.data.idempotent).toBe(true);
          expect(retry.data.offerId).toBe(first.data.offerId);
          expect(retry.data.offerStatus).toBe('pending');
        }
      });
    });
  });
});
