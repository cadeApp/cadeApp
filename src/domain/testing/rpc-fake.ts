import { type ActionResult, type DomainErrorCode, err, isDomainErrorCode, ok } from '../errors';
import { computeDocLevel } from '../priority';
import {
  type RpcClientContract,
  type RpcInput,
  type RpcName,
  type RpcOutput,
  RPC_CONTRACTS,
  validateOfferAmountAgainstFloor,
} from '../rpc-contracts';
import {
  type CourierStatus,
  type DeliveryRequestStatus,
  type DocumentReviewStatus,
  type MerchantSubscriptionStatus,
  type OfferStatus,
  type ProfileRole,
  calculateHaversineRouteDistanceM,
} from '../schemas';
import { canCourierSubmitOffer, transitionOffer, transitionRequest } from '../states';

export interface FakeActorContext {
  readonly userId: string;
  readonly role: ProfileRole | null;
  readonly aal: 'aal1' | 'aal2';
  readonly courierStatus: CourierStatus;
  readonly courierAvailable: boolean;
  readonly merchantSubscriptionStatus: MerchantSubscriptionStatus;
  readonly merchantPaidUntil: string | null;
}

export interface FakeRpcOptions {
  readonly minOfferArs?: number;
  readonly requestTtlMinutes?: number;
  readonly pilotActive?: boolean;
  readonly now?: () => Date;
  readonly initialActor?: Partial<FakeActorContext>;
}

export interface FakeRpcClient extends RpcClientContract {
  readonly setForcedError: (code: DomainErrorCode | null) => void;
  readonly setMinOfferArs: (minOfferArs: number) => void;
  readonly setActor: (patch: Partial<FakeActorContext>) => void;
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

export function createFakeRpcClient(options: FakeRpcOptions = {}): FakeRpcClient {
  let forcedError: DomainErrorCode | null = null;
  let minOfferArs = options.minOfferArs ?? 1000;
  let requestTtlMinutes = options.requestTtlMinutes ?? 30;
  let pilotActive = options.pilotActive ?? true;
  const nowFn = options.now ?? (() => new Date('2026-09-22T15:00:00.000Z'));

  let actor: FakeActorContext = {
    ...DEFAULT_ACTOR,
    ...options.initialActor,
  };

  const requests = new Map<
    string,
    {
      status: DeliveryRequestStatus;
      expiresAt: string;
      acceptedOfferId: string | null;
    }
  >();

  const offers = new Map<
    string,
    {
      requestId: string;
      courierId: string;
      amountArs: number;
      status: OfferStatus;
    }
  >();

  async function executeRpc<K extends RpcName>(
    rpcName: K,
    rawInput: RpcInput<K>,
    requireAdmin: boolean,
    handler: (validInput: RpcInput<K>) => ActionResult<RpcOutput<K>, DomainErrorCode>
  ): Promise<ActionResult<RpcOutput<K>, DomainErrorCode>> {
    if (forcedError !== null) {
      const code = forcedError;
      forcedError = null;
      return err(code);
    }
    if (requireAdmin) {
      if (!actor.role) return err('UNAUTHENTICATED');
      if (actor.role !== 'admin') return err('UNAUTHORIZED_ACTOR');
      if (actor.aal !== 'aal2') return err('AAL2_REQUIRED');
    }
    const parsed = RPC_CONTRACTS[rpcName].inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstMsg = parsed.error.issues[0]?.message;
      return err(isDomainErrorCode(firstMsg) ? firstMsg : 'VALIDATION_ERROR');
    }
    return handler(parsed.data as RpcInput<K>);
  }

  return {
    setForcedError(code) {
      forcedError = code;
    },

    setMinOfferArs(nextFloor) {
      minOfferArs = nextFloor;
    },

    setActor(patch) {
      actor = { ...actor, ...patch };
    },

    async triggerErrorCode(code) {
      forcedError = code;
      return executeRpc('set_availability', { available: true }, false, () =>
        ok({ courierId: actor.userId, available: true })
      ) as Promise<ActionResult<never, DomainErrorCode>>;
    },

    publish_request: (rawInput) =>
      executeRpc('publish_request', rawInput, false, (input) => {
        const currentNow = nowFn();
        const transition = transitionRequest({
          from: 'draft',
          to: 'published',
          actor: actor.role ?? 'merchant',
          isOwnerMerchant: true,
          subscriptionStatus: actor.merchantSubscriptionStatus,
          pilotActive,
          paidUntil: actor.merchantPaidUntil,
          now: currentNow,
        });
        if (!transition.ok) return transition;

        const expiresAt = new Date(currentNow.getTime() + requestTtlMinutes * 60_000).toISOString();
        requests.set(input.requestId, {
          status: 'published',
          expiresAt,
          acceptedOfferId: null,
        });

        return ok({
          requestId: input.requestId,
          status: 'published',
          publishedAt: currentNow.toISOString(),
          expiresAt,
          routeDistanceM: 1500,
        });
      }),

    cancel_request: (rawInput) =>
      executeRpc('cancel_request', rawInput, false, (input) => {
        const req = requests.get(input.requestId) ?? {
          status: 'published' as const,
          expiresAt: new Date(nowFn().getTime() + 1_800_000).toISOString(),
          acceptedOfferId: null,
        };
        const transition = transitionRequest({
          from: req.status,
          to: 'cancelled',
          actor: actor.role === 'admin' ? 'admin' : 'merchant',
          isOwnerMerchant: true,
          expiresAt: req.expiresAt,
          reason: input.reason ?? 'Cancelado',
          now: nowFn(),
        });
        if (!transition.ok) return transition;

        requests.set(input.requestId, { ...req, status: 'cancelled' });
        return ok({
          requestId: input.requestId,
          status: 'cancelled',
          cancelledAt: nowFn().toISOString(),
        });
      }),

    submit_offer: (rawInput) =>
      executeRpc('submit_offer', rawInput, false, (input) => {
        const eligibility = canCourierSubmitOffer({
          status: actor.courierStatus,
          available: actor.courierAvailable,
        });
        if (!eligibility.ok) return eligibility;

        const floorCheck = validateOfferAmountAgainstFloor(input.amountArs, minOfferArs);
        if (!floorCheck.ok) return floorCheck;

        for (const existing of offers.values()) {
          if (
            existing.requestId === input.requestId &&
            existing.courierId === actor.userId &&
            (existing.status === 'pending' || existing.status === 'accepted')
          ) {
            return err('DUPLICATE_ACTIVE_OFFER');
          }
        }

        const offerId = '22222222-2222-4222-8222-222222222222';
        offers.set(offerId, {
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
          createdAt: nowFn().toISOString(),
        });
      }),

    withdraw_offer: (rawInput) =>
      executeRpc('withdraw_offer', rawInput, false, (input) => {
        const offer = offers.get(input.offerId) ?? {
          requestId: '11111111-1111-4111-8111-111111111111',
          courierId: actor.userId,
          amountArs: minOfferArs,
          status: 'pending' as const,
        };
        const transition = transitionOffer(offer.status, 'withdrawn', 'courier');
        if (!transition.ok) return err('OFFER_NOT_PENDING');

        offers.set(input.offerId, { ...offer, status: 'withdrawn' });
        return ok({
          offerId: input.offerId,
          status: 'withdrawn',
          decidedAt: nowFn().toISOString(),
        });
      }),

    accept_offer: (rawInput) =>
      executeRpc('accept_offer', rawInput, false, (input) => {
        const offer = offers.get(input.offerId) ?? {
          requestId: '11111111-1111-4111-8111-111111111111',
          courierId: actor.userId,
          amountArs: minOfferArs,
          status: 'pending' as const,
        };
        const req = requests.get(offer.requestId) ?? {
          status: 'published' as const,
          expiresAt: new Date(nowFn().getTime() + 1_800_000).toISOString(),
          acceptedOfferId: null,
        };

        if (req.status === 'matched' && req.acceptedOfferId === input.offerId) {
          return ok({
            requestId: offer.requestId,
            acceptedOfferId: input.offerId,
            status: 'matched',
            matchedAt: nowFn().toISOString(),
            idempotent: true,
          });
        }
        if (req.status === 'matched') {
          return err('ALREADY_MATCHED');
        }

        offers.set(input.offerId, { ...offer, status: 'accepted' });
        requests.set(offer.requestId, {
          ...req,
          status: 'matched',
          acceptedOfferId: input.offerId,
        });

        return ok({
          requestId: offer.requestId,
          acceptedOfferId: input.offerId,
          status: 'matched',
          matchedAt: nowFn().toISOString(),
          idempotent: false,
        });
      }),

    mark_picked_up: (rawInput) =>
      executeRpc('mark_picked_up', rawInput, false, (input) =>
        ok({
          requestId: input.requestId,
          status: 'in_transit',
          pickedUpAt: nowFn().toISOString(),
        })
      ),

    mark_delivered: (rawInput) =>
      executeRpc('mark_delivered', rawInput, false, (input) =>
        ok({
          requestId: input.requestId,
          status: 'delivered',
          deliveredAt: nowFn().toISOString(),
        })
      ),

    report_no_show: (rawInput) =>
      executeRpc('report_no_show', rawInput, false, (input) => {
        const nextStatus = input.republish === false ? 'cancelled' : 'published';
        return ok({
          requestId: input.requestId,
          status: nextStatus,
          cancelledOfferId: '22222222-2222-4222-8222-222222222222',
          expiresAt:
            nextStatus === 'published'
              ? new Date(nowFn().getTime() + requestTtlMinutes * 60_000).toISOString()
              : null,
        });
      }),

    courier_cancel_match: (rawInput) =>
      executeRpc('courier_cancel_match', rawInput, false, (input) =>
        ok({
          requestId: input.requestId,
          status: 'published',
          cancelledOfferId: '22222222-2222-4222-8222-222222222222',
          expiresAt: new Date(nowFn().getTime() + requestTtlMinutes * 60_000).toISOString(),
        })
      ),

    republish_request: (rawInput) =>
      executeRpc('republish_request', rawInput, false, (input) => {
        const currentNow = nowFn();
        return ok({
          requestId: input.requestId,
          status: 'published',
          publishedAt: currentNow.toISOString(),
          expiresAt: new Date(currentNow.getTime() + requestTtlMinutes * 60_000).toISOString(),
        });
      }),

    report_incident: (rawInput) =>
      executeRpc('report_incident', rawInput, false, (input) =>
        ok({
          incidentId: '33333333-3333-4333-8333-333333333333',
          requestId: input.requestId,
          status: 'open',
          createdAt: nowFn().toISOString(),
        })
      ),

    set_availability: (rawInput) =>
      executeRpc('set_availability', rawInput, false, (input) => {
        if (actor.courierStatus === 'suspended') return err('COURIER_SUSPENDED');
        if (actor.courierStatus !== 'approved') return err('COURIER_NOT_APPROVED');
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
          return ok({
            routeDistanceM: calculateHaversineRouteDistanceM(
              { lat: input.pickupLat, lng: input.pickupLng },
              { lat: input.dropoffLat, lng: input.dropoffLng }
            ),
            usedZoneFallback: false,
          });
        }
        return ok({
          routeDistanceM: 1500,
          usedZoneFallback: true,
        });
      }),

    admin_decide_courier: (rawInput) =>
      executeRpc('admin_decide_courier', rawInput, true, (input) =>
        ok({
          courierId: input.courierId,
          status: input.decision,
          decidedAt: nowFn().toISOString(),
        })
      ),

    admin_suspend_courier: (rawInput) =>
      executeRpc('admin_suspend_courier', rawInput, true, (input) =>
        ok({
          courierId: input.courierId,
          status: 'suspended',
          withdrawnOffersCount: 0,
          deactivatedAt: nowFn().toISOString(),
        })
      ),

    admin_verify_document: (rawInput) =>
      executeRpc('admin_verify_document', rawInput, true, (input) => {
        const status: DocumentReviewStatus = input.decision;
        return ok({
          documentId: input.documentId,
          courierId: actor.userId,
          kind: 'license',
          status,
          docLevel: computeDocLevel(status, 'none'),
        });
      }),

    admin_set_subscription: (rawInput) =>
      executeRpc('admin_set_subscription', rawInput, true, (input) =>
        ok({
          merchantId: input.merchantId,
          subscriptionStatus: input.subscriptionStatus,
          paidUntil: input.paidUntil ?? null,
        })
      ),

    admin_update_setting: (rawInput) =>
      executeRpc('admin_update_setting', rawInput, true, (input) => {
        if (input.key === 'min_offer_ars' && typeof input.value === 'number') {
          minOfferArs = input.value;
        }
        if (input.key === 'request_ttl_minutes' && typeof input.value === 'number') {
          requestTtlMinutes = input.value;
        }
        if (input.key === 'pilot_active' && typeof input.value === 'boolean') {
          pilotActive = input.value;
        }
        return ok({
          key: input.key,
          value: input.value,
        });
      }),
  };
}
