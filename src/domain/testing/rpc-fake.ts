import { type ActionResult, type DomainErrorCode, err, isDomainErrorCode, ok } from '../errors';
import { computeDocLevel } from '../priority';
import {
  type RpcClientContract,
  type RpcErrorCode,
  type RpcInput,
  type RpcName,
  type RpcOutput,
  RPC_CONTRACTS,
  validateOfferAmountAgainstFloor,
} from '../rpc-contracts';
import {
  type CourierDocumentKind,
  type CourierStatus,
  type DeliveryRequestStatus,
  type DocumentReviewStatus,
  type MerchantSubscriptionStatus,
  type OfferStatus,
  PLATFORM_SETTING_KEYS,
  type PlatformSettingKey,
  type ProfileRole,
  calculateHaversineRouteDistanceM,
  formatZoneToZoneDisplayLabel,
  isWithinAguilaresBounds,
} from '../schemas';
import {
  canCourierBeAccepted,
  canCourierSubmitOffer,
  canMerchantPublishRequest,
  isRequestExpired,
  transitionOffer,
  transitionRequest,
} from '../states';

export interface FakePlatformSettings {
  readonly minOfferArs: number;
  readonly maxOffersPerMin: number;
  readonly maxRequestPublicationsPerMin: number;
  readonly maxIncidentsPerMin: number;
  readonly requestTtlMinutes: number;
  readonly pilotActive: boolean;
  readonly pilotTermsVersion: string;
  readonly subscriptionGraceDays: number;
}

export interface FakeActorContext {
  readonly userId: string;
  readonly role: ProfileRole | null;
  readonly aal: 'aal1' | 'aal2';
  readonly courierStatus: CourierStatus;
  readonly courierAvailable: boolean;
  readonly merchantSubscriptionStatus: MerchantSubscriptionStatus;
  readonly merchantPaidUntil: string | null;
}

export interface FakeSeedRequest {
  readonly requestId: string;
  readonly merchantId: string;
  readonly status: DeliveryRequestStatus;
  readonly expiresAt?: string | null;
  readonly matchedAt?: string | null;
  readonly deliveredAt?: string | null;
  readonly acceptedOfferId?: string | null;
  readonly assignedCourierId?: string | null;
  readonly pickupLat?: number | null;
  readonly pickupLng?: number | null;
  readonly dropoffLat?: number | null;
  readonly dropoffLng?: number | null;
  readonly pickupZoneName?: string;
  readonly dropoffZoneName?: string;
}

export interface FakeRequestRecord {
  readonly requestId: string;
  readonly merchantId: string;
  status: DeliveryRequestStatus;
  expiresAt: string | null;
  matchedAt: string | null;
  deliveredAt: string | null;
  acceptedOfferId: string | null;
  assignedCourierId: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  pickupZoneName: string;
  dropoffZoneName: string;
}

export interface FakeSeedOffer {
  readonly offerId: string;
  readonly requestId: string;
  readonly courierId: string;
  readonly amountArs: number;
  readonly status: OfferStatus;
}

export interface FakeOfferRecord {
  readonly offerId: string;
  readonly requestId: string;
  readonly courierId: string;
  readonly amountArs: number;
  status: OfferStatus;
}

export interface FakeSeedCourier {
  readonly courierId: string;
  readonly status: CourierStatus;
  readonly available: boolean;
  readonly licenseStatus?: DocumentReviewStatus;
  readonly insuranceStatus?: DocumentReviewStatus;
}

export interface FakeCourierRecord {
  readonly courierId: string;
  status: CourierStatus;
  available: boolean;
  licenseStatus: DocumentReviewStatus;
  insuranceStatus: DocumentReviewStatus;
}

export interface FakeSeedMerchant {
  readonly merchantId: string;
  readonly subscriptionStatus: MerchantSubscriptionStatus;
  readonly paidUntil?: string | null;
}

export interface FakeMerchantRecord {
  readonly merchantId: string;
  subscriptionStatus: MerchantSubscriptionStatus;
  paidUntil: string | null;
}

export interface FakeSeedDocument {
  readonly documentId: string;
  readonly courierId: string;
  readonly kind: CourierDocumentKind;
  readonly status: DocumentReviewStatus;
  readonly purgedAt?: string | null;
}

export interface FakeDocumentRecord {
  readonly documentId: string;
  readonly courierId: string;
  readonly kind: CourierDocumentKind;
  status: DocumentReviewStatus;
  purgedAt?: string | null;
}

export interface FakeRpcOptions {
  readonly settings: FakePlatformSettings;
  readonly now?: () => Date;
  readonly initialActor?: Partial<FakeActorContext>;
  readonly initialRequests?: readonly FakeSeedRequest[];
  readonly initialOffers?: readonly FakeSeedOffer[];
  readonly initialCouriers?: readonly FakeSeedCourier[];
  readonly initialMerchants?: readonly FakeSeedMerchant[];
  readonly initialDocuments?: readonly FakeSeedDocument[];
}

export interface FakeRpcClient extends RpcClientContract {
  readonly setForcedError: <K extends RpcName>(rpcName: K, code: RpcErrorCode<K> | null) => void;
  readonly setMinOfferArs: (minOfferArs: number) => void;
  readonly setActor: (patch: Partial<FakeActorContext>) => void;
  readonly seedRequest: (request: FakeSeedRequest) => void;
  readonly seedOffer: (offer: FakeSeedOffer) => void;
  readonly seedCourier: (courier: FakeSeedCourier) => void;
  readonly seedMerchant: (merchant: FakeSeedMerchant) => void;
  readonly seedDocument: (doc: FakeSeedDocument) => void;
  readonly getRequest: (requestId: string) => FakeRequestRecord | undefined;
  readonly getOffer: (offerId: string) => FakeOfferRecord | undefined;
  readonly getCourier: (courierId: string) => FakeCourierRecord | undefined;
  readonly getSettings: () => FakePlatformSettings;
  readonly triggerErrorCode: (
    code: DomainErrorCode
  ) => Promise<ActionResult<never, DomainErrorCode>>;
}

const DEFAULT_ACTOR: FakeActorContext = {
  userId: '00000000-0000-4000-8000-000000000001',
  role: 'courier',
  aal: 'aal2',
  courierStatus: 'approved',
  courierAvailable: true,
  merchantSubscriptionStatus: 'pilot',
  merchantPaidUntil: null,
};

const ALLOWED_ROLES_BY_RPC: { readonly [K in RpcName]: readonly ProfileRole[] } = {
  publish_request: ['merchant'],
  cancel_request: ['merchant', 'admin'],
  submit_offer: ['courier'],
  withdraw_offer: ['courier'],
  accept_offer: ['merchant'],
  mark_picked_up: ['courier'],
  mark_delivered: ['courier'],
  report_no_show: ['merchant'],
  courier_cancel_match: ['courier'],
  republish_request: ['merchant'],
  report_incident: ['merchant', 'courier', 'admin'],
  set_availability: ['courier'],
  calculate_route_distance: ['merchant', 'courier', 'admin'],
  admin_decide_courier: ['admin'],
  admin_suspend_courier: ['admin'],
  admin_verify_document: ['admin'],
  admin_set_subscription: ['admin'],
  admin_update_setting: ['admin'],
};

const ACTIVE_INCIDENT_STATUSES: readonly DeliveryRequestStatus[] = [
  'published',
  'matched',
  'in_transit',
];

const INCIDENT_WINDOW_MS = 24 * 3_600_000;

function assertValidFakeOptions(options: FakeRpcOptions | undefined): FakePlatformSettings {
  if (!options || typeof options !== 'object' || !options.settings) {
    throw new Error(
      'createFakeRpcClient requires explicit options.settings (minOfferArs, maxOffersPerMin, maxRequestPublicationsPerMin, maxIncidentsPerMin, requestTtlMinutes, pilotActive, pilotTermsVersion, subscriptionGraceDays)'
    );
  }
  const { settings } = options;
  if (
    !Number.isInteger(settings.minOfferArs) ||
    settings.minOfferArs < 1 ||
    !Number.isInteger(settings.maxOffersPerMin) ||
    settings.maxOffersPerMin < 1 ||
    !Number.isInteger(settings.maxRequestPublicationsPerMin) ||
    settings.maxRequestPublicationsPerMin < 1 ||
    !Number.isInteger(settings.maxIncidentsPerMin) ||
    settings.maxIncidentsPerMin < 1 ||
    !Number.isInteger(settings.requestTtlMinutes) ||
    settings.requestTtlMinutes < 1 ||
    typeof settings.pilotActive !== 'boolean' ||
    typeof settings.pilotTermsVersion !== 'string' ||
    settings.pilotTermsVersion.trim().length === 0 ||
    !Number.isInteger(settings.subscriptionGraceDays) ||
    settings.subscriptionGraceDays < 0
  ) {
    throw new Error('createFakeRpcClient received invalid options.settings values');
  }
  return { ...settings };
}

export function createFakeRpcClient(options: FakeRpcOptions): FakeRpcClient {
  let settings: FakePlatformSettings = assertValidFakeOptions(options);
  const forcedErrors = new Map<RpcName, DomainErrorCode>();
  const nowFn = options.now ?? (() => new Date('2026-09-22T15:00:00.000Z'));

  let actor: FakeActorContext = {
    ...DEFAULT_ACTOR,
    ...options.initialActor,
  };

  let offerSeq = 0;
  let incidentSeq = 0;

  const requests = new Map<string, FakeRequestRecord>();
  const offers = new Map<string, FakeOfferRecord>();
  const couriers = new Map<string, FakeCourierRecord>();
  const merchants = new Map<string, FakeMerchantRecord>();
  const documents = new Map<string, FakeDocumentRecord>();
  const rateLimits = new Map<string, number>();

  function getWindowBucketKey(subject: string, action: string, currentNow: Date): string {
    const minuteIso = new Date(Math.floor(currentNow.getTime() / 60_000) * 60_000).toISOString();
    return `${subject}:${action}:${minuteIso}`;
  }

  function getWindowRateCount(subject: string, action: string, currentNow: Date): number {
    return rateLimits.get(getWindowBucketKey(subject, action, currentNow)) ?? 0;
  }

  function incrementWindowRateCount(subject: string, action: string, currentNow: Date): number {
    const key = getWindowBucketKey(subject, action, currentNow);
    const next = (rateLimits.get(key) ?? 0) + 1;
    rateLimits.set(key, next);
    return next;
  }

  function consumeRequestRate(
    action: 'publish_request' | 'report_incident',
    limit: number,
    currentNow: Date
  ): ActionResult<true, 'RATE_LIMITED'> {
    if (getWindowRateCount(actor.userId, action, currentNow) >= limit) {
      return err('RATE_LIMITED');
    }
    incrementWindowRateCount(actor.userId, action, currentNow);
    return ok(true);
  }

  function nextUniqueOfferId(): string {
    while (true) {
      offerSeq += 1;
      const candidate = `00000000-0000-4000-8000-${String(offerSeq).padStart(12, '0')}`;
      if (!offers.has(candidate)) {
        return candidate;
      }
    }
  }

  function putRequest(r: FakeSeedRequest) {
    requests.set(r.requestId, {
      requestId: r.requestId,
      merchantId: r.merchantId,
      status: r.status,
      expiresAt: r.expiresAt ?? null,
      matchedAt: r.matchedAt ?? null,
      deliveredAt: r.deliveredAt ?? null,
      acceptedOfferId: r.acceptedOfferId ?? null,
      assignedCourierId: r.assignedCourierId ?? null,
      pickupLat: r.pickupLat ?? null,
      pickupLng: r.pickupLng ?? null,
      dropoffLat: r.dropoffLat ?? null,
      dropoffLng: r.dropoffLng ?? null,
      pickupZoneName: r.pickupZoneName ?? 'Centro',
      dropoffZoneName: r.dropoffZoneName ?? 'Villa Nueva',
    });
  }

  function putCourier(c: FakeSeedCourier) {
    const prev = couriers.get(c.courierId);
    couriers.set(c.courierId, {
      courierId: c.courierId,
      status: c.status,
      available: c.available,
      licenseStatus: c.licenseStatus ?? prev?.licenseStatus ?? 'none',
      insuranceStatus: c.insuranceStatus ?? prev?.insuranceStatus ?? 'none',
    });
  }

  function putMerchant(m: FakeSeedMerchant) {
    merchants.set(m.merchantId, {
      merchantId: m.merchantId,
      subscriptionStatus: m.subscriptionStatus,
      paidUntil: m.paidUntil ?? null,
    });
  }

  function syncActorRecords(currentActor: FakeActorContext) {
    if (currentActor.role === 'courier') {
      putCourier({
        courierId: currentActor.userId,
        status: currentActor.courierStatus,
        available: currentActor.courierAvailable,
      });
    } else if (currentActor.role === 'merchant') {
      putMerchant({
        merchantId: currentActor.userId,
        subscriptionStatus: currentActor.merchantSubscriptionStatus,
        paidUntil: currentActor.merchantPaidUntil,
      });
    }
  }

  syncActorRecords(actor);
  (options.initialRequests ?? []).forEach(putRequest);
  (options.initialOffers ?? []).forEach((o) => offers.set(o.offerId, { ...o }));
  (options.initialCouriers ?? []).forEach(putCourier);
  (options.initialMerchants ?? []).forEach(putMerchant);
  (options.initialDocuments ?? []).forEach((d) => documents.set(d.documentId, { ...d }));

  function checkCourierEligibility(): ActionResult<
    FakeCourierRecord,
    'NOT_FOUND' | 'COURIER_SUSPENDED' | 'COURIER_NOT_APPROVED'
  > {
    const courier = couriers.get(actor.userId);
    if (!courier) return err('NOT_FOUND');
    if (courier.status === 'suspended') return err('COURIER_SUSPENDED');
    if (courier.status !== 'approved') return err('COURIER_NOT_APPROVED');
    return ok(courier);
  }

  async function executeRpc<K extends RpcName>(
    rpcName: K,
    rawInput: RpcInput<K>,
    requireAdminAal2: boolean,
    handler: (validInput: RpcInput<K>) => ActionResult<RpcOutput<K>, RpcErrorCode<K>>
  ): Promise<ActionResult<RpcOutput<K>, RpcErrorCode<K>>> {
    const forced = forcedErrors.get(rpcName);
    if (forced !== undefined) {
      forcedErrors.delete(rpcName);
      return err(forced as RpcErrorCode<K>);
    }
    if (!actor.userId || !actor.role) {
      return err('UNAUTHENTICATED' as RpcErrorCode<K>);
    }
    if (!ALLOWED_ROLES_BY_RPC[rpcName].includes(actor.role)) {
      return err('UNAUTHORIZED_ACTOR' as RpcErrorCode<K>);
    }
    if (requireAdminAal2 && actor.aal !== 'aal2') {
      return err('AAL2_REQUIRED' as RpcErrorCode<K>);
    }
    if (rpcName === 'admin_update_setting') {
      const candidate = rawInput as unknown as { readonly key?: unknown } | null;
      const rawKey = candidate && typeof candidate === 'object' ? candidate.key : undefined;
      if (
        typeof rawKey !== 'string' ||
        !PLATFORM_SETTING_KEYS.includes(rawKey as PlatformSettingKey)
      ) {
        return err('INVALID_SETTING_KEY' as RpcErrorCode<K>);
      }
      const settingParsed = RPC_CONTRACTS.admin_update_setting.inputSchema.safeParse(rawInput);
      if (!settingParsed.success) {
        return err('INVALID_SETTING_VALUE' as RpcErrorCode<K>);
      }
    }
    if (rpcName === 'submit_offer') {
      const courier = couriers.get(actor.userId);
      if (!courier) {
        return err('NOT_FOUND' as RpcErrorCode<K>);
      }
      const eligibility = canCourierSubmitOffer({
        status: courier.status,
        available: courier.available,
      });
      if (!eligibility.ok) {
        return err(eligibility.code as RpcErrorCode<K>);
      }
    }
    const parsed = RPC_CONTRACTS[rpcName].inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstMsg = parsed.error.issues[0]?.message;
      const mapped = isDomainErrorCode(firstMsg) ? firstMsg : 'VALIDATION_ERROR';
      return err(mapped as RpcErrorCode<K>);
    }
    const result = handler(parsed.data as RpcInput<K>);
    if (result.ok) {
      const outParsed = RPC_CONTRACTS[rpcName].outputSchema.safeParse(result.data);
      if (!outParsed.success) {
        return err('VALIDATION_ERROR' as RpcErrorCode<K>);
      }
    }
    return result;
  }

  return {
    setForcedError(rpcName, code) {
      if (code === null) {
        forcedErrors.delete(rpcName);
        return;
      }
      const allowed = RPC_CONTRACTS[rpcName]?.errorCodes as readonly DomainErrorCode[] | undefined;
      if (!allowed || !allowed.includes(code)) {
        throw new Error(
          `Error code ${String(code)} is not in RPC_CONTRACTS.${String(rpcName)}.errorCodes`
        );
      }
      forcedErrors.set(rpcName, code);
    },

    setMinOfferArs(nextFloor) {
      if (!Number.isInteger(nextFloor) || nextFloor < 1) {
        throw new Error('minOfferArs must be a positive integer');
      }
      settings = { ...settings, minOfferArs: nextFloor };
    },

    setActor(patch) {
      actor = { ...actor, ...patch };
      syncActorRecords(actor);
    },

    seedRequest: putRequest,
    seedOffer: (o) => offers.set(o.offerId, { ...o }),
    seedCourier: putCourier,
    seedMerchant: putMerchant,
    seedDocument: (d) => documents.set(d.documentId, { ...d }),
    getRequest: (requestId) => requests.get(requestId),
    getOffer: (offerId) => offers.get(offerId),
    getCourier: (courierId) => couriers.get(courierId),
    getSettings: () => ({ ...settings }),
    triggerErrorCode: async (code) => err(code),

    publish_request: (rawInput) =>
      executeRpc('publish_request', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        const merchant = merchants.get(actor.userId);
        if (!req || !merchant) return err('NOT_FOUND');

        const currentNow = nowFn();
        const transition = transitionRequest({
          from: req.status,
          to: 'published',
          actor: 'merchant',
          isOwnerMerchant: req.merchantId === actor.userId,
          subscriptionStatus: merchant.subscriptionStatus,
          pilotActive: settings.pilotActive,
          paidUntil: merchant.paidUntil,
          graceDays: settings.subscriptionGraceDays,
          now: currentNow,
        });
        if (!transition.ok) {
          return err(transition.code as RpcErrorCode<'publish_request'>);
        }

        let routeDistanceM: number | null = null;
        if (
          req.pickupLat !== null &&
          req.pickupLng !== null &&
          req.dropoffLat !== null &&
          req.dropoffLng !== null
        ) {
          if (
            !isWithinAguilaresBounds(req.pickupLat, req.pickupLng) ||
            !isWithinAguilaresBounds(req.dropoffLat, req.dropoffLng)
          ) {
            return err('OUT_OF_BOUNDS_AGUILARES');
          }
          routeDistanceM = calculateHaversineRouteDistanceM(
            { lat: req.pickupLat, lng: req.pickupLng },
            { lat: req.dropoffLat, lng: req.dropoffLng }
          );
        }

        const rate = consumeRequestRate(
          'publish_request',
          settings.maxRequestPublicationsPerMin,
          currentNow
        );
        if (!rate.ok) return rate;
        const publishedAt = currentNow.toISOString();
        const expiresAt = new Date(
          currentNow.getTime() + settings.requestTtlMinutes * 60_000
        ).toISOString();
        req.status = 'published';
        req.expiresAt = expiresAt;

        return ok({
          requestId: input.requestId,
          status: 'published',
          publishedAt,
          expiresAt,
          routeDistanceM,
        });
      }),

    cancel_request: (rawInput) =>
      executeRpc('cancel_request', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');

        const currentNow = nowFn();
        const transition = transitionRequest({
          from: req.status,
          to: 'cancelled',
          actor: actor.role === 'admin' ? 'admin' : 'merchant',
          isOwnerMerchant: req.merchantId === actor.userId,
          expiresAt: req.expiresAt,
          reason: input.reason,
          now: currentNow,
        });
        if (!transition.ok) {
          return err(transition.code as RpcErrorCode<'cancel_request'>);
        }

        if (transition.data.offerSideEffect === 'expire_all_pending') {
          for (const offer of offers.values()) {
            if (offer.requestId === req.requestId && offer.status === 'pending') {
              offer.status = 'expired';
            }
          }
        } else if (transition.data.offerSideEffect === 'cancel_accepted' && req.acceptedOfferId) {
          const accepted = offers.get(req.acceptedOfferId);
          if (accepted) accepted.status = 'cancelled';
        }

        req.status = 'cancelled';
        return ok({
          requestId: input.requestId,
          status: 'cancelled',
          cancelledAt: currentNow.toISOString(),
        });
      }),

    submit_offer: (rawInput) =>
      executeRpc('submit_offer', rawInput, false, (input) => {
        const floorCheck = validateOfferAmountAgainstFloor(input.amountArs, settings.minOfferArs);
        if (!floorCheck.ok) {
          return err(floorCheck.code as RpcErrorCode<'submit_offer'>);
        }

        const currentNow = nowFn();
        if (
          getWindowRateCount(actor.userId, 'submit_offer', currentNow) + 1 >
          settings.maxOffersPerMin
        ) {
          return err('RATE_LIMITED');
        }

        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');

        if (isRequestExpired(req.status, req.expiresAt, currentNow)) {
          return err('REQUEST_EXPIRED');
        }
        if (req.status !== 'published') {
          return err('INVALID_STATE_TRANSITION');
        }

        for (const existing of offers.values()) {
          if (
            existing.requestId === input.requestId &&
            existing.courierId === actor.userId &&
            (existing.status === 'pending' || existing.status === 'accepted')
          ) {
            return err('DUPLICATE_ACTIVE_OFFER');
          }
        }

        incrementWindowRateCount(actor.userId, 'submit_offer', currentNow);

        const offerId = nextUniqueOfferId();
        offers.set(offerId, {
          offerId,
          requestId: input.requestId,
          courierId: actor.userId,
          amountArs: input.amountArs,
          status: 'pending',
        });

        return ok({
          offerId,
          requestId: input.requestId,
          status: 'pending',
          amountArs: input.amountArs,
          createdAt: currentNow.toISOString(),
        });
      }),

    withdraw_offer: (rawInput) =>
      executeRpc('withdraw_offer', rawInput, false, (input) => {
        const offer = offers.get(input.offerId);
        if (!offer) return err('NOT_FOUND');
        if (offer.courierId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }
        const transition = transitionOffer(offer.status, 'withdrawn', 'courier');
        if (!transition.ok) return err('OFFER_NOT_PENDING');

        const currentNow = nowFn();
        if (
          getWindowRateCount(actor.userId, 'withdraw_offer', currentNow) + 1 >
          settings.maxOffersPerMin
        ) {
          return err('RATE_LIMITED');
        }

        incrementWindowRateCount(actor.userId, 'withdraw_offer', currentNow);
        offer.status = 'withdrawn';
        return ok({
          offerId: input.offerId,
          status: 'withdrawn',
          decidedAt: currentNow.toISOString(),
        });
      }),

    accept_offer: (rawInput) =>
      executeRpc('accept_offer', rawInput, false, (input) => {
        const offer = offers.get(input.offerId);
        if (!offer) return err('NOT_FOUND');

        const req = requests.get(offer.requestId);
        const offerCourier = couriers.get(offer.courierId);
        if (!req || !offerCourier) return err('NOT_FOUND');

        if (req.merchantId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        const currentNow = nowFn();
        if (req.status === 'matched' && req.acceptedOfferId === input.offerId) {
          return ok({
            requestId: offer.requestId,
            acceptedOfferId: input.offerId,
            status: 'matched',
            matchedAt: req.matchedAt ?? currentNow.toISOString(),
            idempotent: true,
          });
        }
        if (req.status === 'matched') {
          return err('ALREADY_MATCHED');
        }
        if (isRequestExpired(req.status, req.expiresAt, currentNow)) {
          return err('REQUEST_EXPIRED');
        }
        if (req.status !== 'published') {
          return err('INVALID_STATE_TRANSITION');
        }
        if (offer.status !== 'pending') {
          return err('OFFER_NOT_PENDING');
        }

        const courierCheck = canCourierBeAccepted({ status: offerCourier.status });
        if (!courierCheck.ok) {
          return err(courierCheck.code as RpcErrorCode<'accept_offer'>);
        }

        const matchedIso = currentNow.toISOString();
        offer.status = 'accepted';
        for (const sibling of offers.values()) {
          if (
            sibling.requestId === offer.requestId &&
            sibling.offerId !== offer.offerId &&
            sibling.status === 'pending'
          ) {
            sibling.status = 'rejected';
          }
        }

        req.status = 'matched';
        req.acceptedOfferId = input.offerId;
        req.assignedCourierId = offer.courierId;
        req.matchedAt = matchedIso;

        return ok({
          requestId: offer.requestId,
          acceptedOfferId: input.offerId,
          status: 'matched',
          matchedAt: matchedIso,
          idempotent: false,
        });
      }),

    mark_picked_up: (rawInput) =>
      executeRpc('mark_picked_up', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        const eligibility = checkCourierEligibility();
        if (!eligibility.ok) return eligibility;

        const currentNow = nowFn();
        const transition = transitionRequest({
          from: req.status,
          to: 'in_transit',
          actor: 'courier',
          isAssignedCourier: req.assignedCourierId === actor.userId,
          now: currentNow,
        });
        if (!transition.ok) {
          return err(transition.code as RpcErrorCode<'mark_picked_up'>);
        }

        req.status = 'in_transit';
        return ok({
          requestId: input.requestId,
          status: 'in_transit',
          pickedUpAt: currentNow.toISOString(),
        });
      }),

    mark_delivered: (rawInput) =>
      executeRpc('mark_delivered', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        const eligibility = checkCourierEligibility();
        if (!eligibility.ok) return eligibility;

        const currentNow = nowFn();
        const transition = transitionRequest({
          from: req.status,
          to: 'delivered',
          actor: 'courier',
          isAssignedCourier: req.assignedCourierId === actor.userId,
          now: currentNow,
        });
        if (!transition.ok) {
          return err(transition.code as RpcErrorCode<'mark_delivered'>);
        }

        const deliveredAt = currentNow.toISOString();
        req.status = 'delivered';
        req.deliveredAt = deliveredAt;
        return ok({
          requestId: input.requestId,
          status: 'delivered',
          deliveredAt,
        });
      }),

    report_no_show: (rawInput) =>
      executeRpc('report_no_show', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        const merchant = merchants.get(actor.userId);
        if (!req || !merchant) return err('NOT_FOUND');

        const nextStatus = input.republish === false ? 'cancelled' : 'published';
        const currentNow = nowFn();

        if (nextStatus === 'published') {
          const subCheck = canMerchantPublishRequest({
            subscriptionStatus: merchant.subscriptionStatus,
            pilotActive: settings.pilotActive,
            paidUntil: merchant.paidUntil,
            graceDays: settings.subscriptionGraceDays,
            now: currentNow,
          });
          if (!subCheck.ok) {
            return err(subCheck.code as RpcErrorCode<'report_no_show'>);
          }
        }

        const transition = transitionRequest({
          from: req.status,
          to: nextStatus,
          actor: 'merchant',
          isOwnerMerchant: req.merchantId === actor.userId,
          reason: 'no_show',
          now: currentNow,
        });
        if (!transition.ok) {
          return err(transition.code as RpcErrorCode<'report_no_show'>);
        }

        const cancelledOfferId = req.acceptedOfferId;
        if (!cancelledOfferId || !offers.has(cancelledOfferId)) {
          return err('INVALID_STATE_TRANSITION');
        }
        const acceptedOffer = offers.get(cancelledOfferId);
        if (acceptedOffer) {
          acceptedOffer.status = 'cancelled';
        }

        const expiresAt =
          nextStatus === 'published'
            ? new Date(currentNow.getTime() + settings.requestTtlMinutes * 60_000).toISOString()
            : null;

        req.status = nextStatus;
        req.acceptedOfferId = null;
        req.assignedCourierId = null;
        req.expiresAt = expiresAt;

        return ok({
          requestId: input.requestId,
          status: nextStatus,
          cancelledOfferId,
          expiresAt,
        });
      }),

    courier_cancel_match: (rawInput) =>
      executeRpc('courier_cancel_match', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        const eligibility = checkCourierEligibility();
        if (!eligibility.ok) return eligibility;

        const currentNow = nowFn();
        const transition = transitionRequest({
          from: req.status,
          to: 'published',
          actor: 'courier',
          isAssignedCourier: req.assignedCourierId === actor.userId,
          reason: input.reason,
          now: currentNow,
        });
        if (!transition.ok) {
          return err(transition.code as RpcErrorCode<'courier_cancel_match'>);
        }

        const cancelledOfferId = req.acceptedOfferId;
        if (!cancelledOfferId || !offers.has(cancelledOfferId)) {
          return err('INVALID_STATE_TRANSITION');
        }
        const acceptedOffer = offers.get(cancelledOfferId);
        if (acceptedOffer) {
          acceptedOffer.status = 'cancelled';
        }

        const expiresAt = new Date(
          currentNow.getTime() + settings.requestTtlMinutes * 60_000
        ).toISOString();
        req.status = 'published';
        req.acceptedOfferId = null;
        req.assignedCourierId = null;
        req.expiresAt = expiresAt;

        return ok({
          requestId: input.requestId,
          status: 'published',
          cancelledOfferId,
          expiresAt,
        });
      }),

    republish_request: (rawInput) =>
      executeRpc('republish_request', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        const merchant = merchants.get(actor.userId);
        if (!req || !merchant) return err('NOT_FOUND');
        if (req.merchantId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        const currentNow = nowFn();
        const subCheck = canMerchantPublishRequest({
          subscriptionStatus: merchant.subscriptionStatus,
          pilotActive: settings.pilotActive,
          paidUntil: merchant.paidUntil,
          graceDays: settings.subscriptionGraceDays,
          now: currentNow,
        });
        if (!subCheck.ok) {
          return err(subCheck.code as RpcErrorCode<'republish_request'>);
        }

        if (req.status === 'matched') {
          if (!input.reason || input.reason.trim().length === 0) {
            return err('REASON_REQUIRED');
          }
        } else if (req.status !== 'expired' && req.status !== 'cancelled') {
          return err('INVALID_STATE_TRANSITION');
        }

        const rate = consumeRequestRate(
          'publish_request',
          settings.maxRequestPublicationsPerMin,
          currentNow
        );
        if (!rate.ok) return rate;
        if (req.status === 'matched' && req.acceptedOfferId) {
          const acceptedOffer = offers.get(req.acceptedOfferId);
          if (acceptedOffer) acceptedOffer.status = 'cancelled';
        }

        const publishedAt = currentNow.toISOString();
        const expiresAt = new Date(
          currentNow.getTime() + settings.requestTtlMinutes * 60_000
        ).toISOString();
        req.status = 'published';
        req.acceptedOfferId = null;
        req.assignedCourierId = null;
        req.expiresAt = expiresAt;

        return ok({
          requestId: input.requestId,
          status: 'published',
          publishedAt,
          expiresAt,
        });
      }),

    report_incident: (rawInput) =>
      executeRpc('report_incident', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');

        const isParticipant =
          actor.role === 'admin' ||
          (actor.role === 'merchant' && req.merchantId === actor.userId) ||
          (actor.role === 'courier' && req.assignedCourierId === actor.userId);
        if (!isParticipant) {
          return err('UNAUTHORIZED_ACTOR');
        }
        if (actor.role === 'courier') {
          const eligibility = checkCourierEligibility();
          if (!eligibility.ok) return eligibility;
        }

        const currentNow = nowFn();
        if (req.status === 'delivered') {
          const deliveredMs = req.deliveredAt ? Date.parse(req.deliveredAt) : Number.NaN;
          if (
            Number.isNaN(deliveredMs) ||
            currentNow.getTime() - deliveredMs > INCIDENT_WINDOW_MS
          ) {
            return err('INCIDENT_WINDOW_EXPIRED');
          }
        } else if (!ACTIVE_INCIDENT_STATUSES.includes(req.status)) {
          return err('INVALID_STATE_TRANSITION');
        }

        const rate = consumeRequestRate('report_incident', settings.maxIncidentsPerMin, currentNow);
        if (!rate.ok) return rate;
        incidentSeq += 1;
        const incidentId = `00000000-0000-4000-8000-${String(10_000 + incidentSeq).padStart(12, '0')}`;
        return ok({
          incidentId,
          requestId: input.requestId,
          status: 'open',
          createdAt: currentNow.toISOString(),
        });
      }),

    set_availability: (rawInput) =>
      executeRpc('set_availability', rawInput, false, (input) => {
        const courier = couriers.get(actor.userId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status === 'suspended') return err('COURIER_SUSPENDED');
        if (courier.status !== 'approved') return err('COURIER_NOT_APPROVED');

        courier.available = input.available;
        actor = { ...actor, courierAvailable: input.available };
        return ok({
          courierId: actor.userId,
          available: input.available,
        });
      }),

    calculate_route_distance: (rawInput) =>
      executeRpc('calculate_route_distance', rawInput, false, (input) => {
        if (
          input.pickupLat != null &&
          input.pickupLng != null &&
          input.dropoffLat != null &&
          input.dropoffLng != null
        ) {
          const routeDistanceM = calculateHaversineRouteDistanceM(
            { lat: input.pickupLat, lng: input.pickupLng },
            { lat: input.dropoffLat, lng: input.dropoffLng }
          );
          if (input.pickupZoneName && input.dropoffZoneName) {
            return ok({
              routeDistanceM,
              displayLabel: formatZoneToZoneDisplayLabel(
                input.pickupZoneName,
                input.dropoffZoneName
              ),
            });
          }
          return ok({ routeDistanceM });
        }

        return ok({
          routeDistanceM: null,
          displayLabel: formatZoneToZoneDisplayLabel(input.pickupZoneName, input.dropoffZoneName),
        });
      }),

    admin_decide_courier: (rawInput) =>
      executeRpc('admin_decide_courier', rawInput, true, (input) => {
        if (input.decision !== 'approved' && input.decision !== 'rejected') {
          return err('VALIDATION_ERROR');
        }
        if (input.decision === 'rejected' && (!input.reason || input.reason.trim().length === 0)) {
          return err('REASON_REQUIRED');
        }
        const courier = couriers.get(input.courierId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status !== 'pending') return err('INVALID_STATE_TRANSITION');
        courier.status = input.decision;
        return ok({
          courierId: input.courierId,
          status: input.decision,
          decidedAt: nowFn().toISOString(),
        });
      }),

    admin_suspend_courier: (rawInput) =>
      executeRpc('admin_suspend_courier', rawInput, true, (input) => {
        if (!input.reason || input.reason.trim().length === 0) {
          return err('REASON_REQUIRED');
        }
        const courier = couriers.get(input.courierId);
        if (!courier) return err('NOT_FOUND');

        courier.status = 'suspended';
        courier.available = false;

        let withdrawnOffersCount = 0;
        for (const offer of offers.values()) {
          if (offer.courierId === input.courierId && offer.status === 'pending') {
            offer.status = 'withdrawn';
            withdrawnOffersCount += 1;
          }
        }

        return ok({
          courierId: input.courierId,
          status: 'suspended',
          withdrawnOffersCount,
          deactivatedAt: nowFn().toISOString(),
        });
      }),

    admin_verify_document: (rawInput) =>
      executeRpc('admin_verify_document', rawInput, true, (input) => {
        if (input.decision !== 'verified' && input.decision !== 'rejected') {
          return err('VALIDATION_ERROR');
        }
        if (input.decision === 'rejected' && (!input.reason || input.reason.trim().length === 0)) {
          return err('REASON_REQUIRED');
        }
        const doc = documents.get(input.documentId);
        if (!doc) return err('NOT_FOUND');
        if (doc.status !== 'submitted' || doc.purgedAt != null) {
          return err('INVALID_STATE_TRANSITION');
        }
        const courier = couriers.get(doc.courierId);
        if (!courier) return err('NOT_FOUND');

        doc.status = input.decision;
        if (doc.kind === 'license') courier.licenseStatus = input.decision;
        if (doc.kind === 'insurance') courier.insuranceStatus = input.decision;
        const docLevel = computeDocLevel(courier.licenseStatus, courier.insuranceStatus);

        return ok({
          documentId: input.documentId,
          courierId: doc.courierId,
          kind: doc.kind,
          status: doc.status,
          docLevel,
        });
      }),

    admin_set_subscription: (rawInput) =>
      executeRpc('admin_set_subscription', rawInput, true, (input) => {
        const validStatuses: MerchantSubscriptionStatus[] = ['pilot', 'active', 'expired', 'cancelled'];
        if (!validStatuses.includes(input.subscriptionStatus)) {
          return err('VALIDATION_ERROR');
        }
        const merchant = merchants.get(input.merchantId);
        if (!merchant) return err('NOT_FOUND');

        merchant.subscriptionStatus = input.subscriptionStatus;
        merchant.paidUntil = input.paidUntil ?? null;

        return ok({
          merchantId: input.merchantId,
          subscriptionStatus: merchant.subscriptionStatus,
          paidUntil: merchant.paidUntil,
        });
      }),

    admin_update_setting: (rawInput) =>
      executeRpc('admin_update_setting', rawInput, true, (input) => {
        if (!PLATFORM_SETTING_KEYS.includes(input.key as PlatformSettingKey)) {
          return err('INVALID_SETTING_KEY');
        }
        switch (input.key) {
          case 'min_offer_ars':
            if (typeof input.value !== 'number' || !Number.isInteger(input.value) || input.value < 1) {
              return err('INVALID_SETTING_VALUE');
            }
            settings = { ...settings, minOfferArs: input.value };
            break;
          case 'request_ttl_minutes':
            if (typeof input.value !== 'number' || !Number.isInteger(input.value) || input.value < 1) {
              return err('INVALID_SETTING_VALUE');
            }
            settings = { ...settings, requestTtlMinutes: input.value };
            break;
          case 'pilot_active':
            if (typeof input.value !== 'boolean') {
              return err('INVALID_SETTING_VALUE');
            }
            settings = { ...settings, pilotActive: input.value };
            break;
          case 'pilot_terms_version':
            if (typeof input.value !== 'string' || input.value.trim().length === 0) {
              return err('INVALID_SETTING_VALUE');
            }
            settings = { ...settings, pilotTermsVersion: input.value };
            break;
          case 'subscription_grace_days':
            if (typeof input.value !== 'number' || !Number.isInteger(input.value) || input.value < 0) {
              return err('INVALID_SETTING_VALUE');
            }
            settings = { ...settings, subscriptionGraceDays: input.value };
            break;
        }
        return ok(input);
      }),
  };
}
