import { type ActionResult, type DomainErrorCode, err, ok } from '../errors';
import {
  type CourierStatus,
  type DeliveryRequestStatus,
  type MerchantSubscriptionStatus,
  type OfferStatus,
} from '../schemas';

export const REQUEST_ACTORS = ['merchant', 'courier', 'admin', 'system'] as const;
export type RequestActor = (typeof REQUEST_ACTORS)[number];

export type OfferSideEffect =
  'none' | 'accept_one_reject_others' | 'expire_all_pending' | 'cancel_accepted';

export interface TransitionRequestInput {
  readonly from: DeliveryRequestStatus;
  readonly to: DeliveryRequestStatus;
  readonly actor: RequestActor;
  readonly now: Date;
  readonly expiresAt?: Date | string | null;
  readonly isOwnerMerchant?: boolean;
  readonly isAssignedCourier?: boolean;
  readonly pilotActive?: boolean;
  readonly paidUntil?: Date | string | null;
  readonly subscriptionStatus?: MerchantSubscriptionStatus;
  readonly graceDays?: number;
  readonly reason?: string | null;
}

export interface TransitionRequestOutput {
  readonly status: DeliveryRequestStatus;
  readonly offerSideEffect: OfferSideEffect;
}

function parseTimestampMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = typeof value === 'string' ? Date.parse(value) : value.getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function isRequestExpired(
  status: DeliveryRequestStatus,
  expiresAt: Date | string | null | undefined,
  now: Date
): boolean {
  if (status !== 'published') return false;
  const expiresMs = parseTimestampMs(expiresAt);
  if (expiresMs === null) return false;
  return now.getTime() > expiresMs;
}

export function getEffectiveRequestStatus(
  status: DeliveryRequestStatus,
  expiresAt: Date | string | null | undefined,
  now: Date
): DeliveryRequestStatus {
  return isRequestExpired(status, expiresAt, now) ? 'expired' : status;
}

export interface MerchantPublishCheckInput {
  readonly subscriptionStatus: MerchantSubscriptionStatus;
  readonly pilotActive: boolean;
  readonly paidUntil: Date | string | null | undefined;
  readonly graceDays?: number;
  readonly now: Date;
}

const MS_PER_DAY = 86_400_000;

export function canMerchantPublishRequest(
  input: MerchantPublishCheckInput
): ActionResult<true, DomainErrorCode> {
  if (input.subscriptionStatus === 'cancelled' || input.subscriptionStatus === 'expired') {
    return err('SUBSCRIPTION_INACTIVE');
  }
  if (input.pilotActive && input.subscriptionStatus === 'pilot') {
    return ok(true);
  }
  const paidUntilMs = parseTimestampMs(
    typeof input.paidUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.paidUntil)
      ? `${input.paidUntil}T23:59:59.999-03:00`
      : input.paidUntil
  );
  const graceMs = Math.max(0, input.graceDays ?? 0) * MS_PER_DAY;
  if (paidUntilMs !== null && paidUntilMs + graceMs >= input.now.getTime()) {
    return ok(true);
  }
  return err('SUBSCRIPTION_INACTIVE');
}

export function transitionRequest(
  input: TransitionRequestInput
): ActionResult<TransitionRequestOutput, DomainErrorCode> {
  const { from, to, actor, now } = input;

  if (
    from === 'published' &&
    to !== 'expired' &&
    isRequestExpired('published', input.expiresAt, now)
  ) {
    return err('REQUEST_EXPIRED');
  }

  const transitionKey = `${from}->${to}`;

  switch (transitionKey) {
    case 'draft->published': {
      if (actor !== 'merchant' || input.isOwnerMerchant !== true) {
        return err('UNAUTHORIZED_ACTOR');
      }
      if (!input.subscriptionStatus) {
        return err('SUBSCRIPTION_INACTIVE');
      }
      const subCheck = canMerchantPublishRequest({
        subscriptionStatus: input.subscriptionStatus,
        pilotActive: input.pilotActive ?? false,
        paidUntil: input.paidUntil,
        graceDays: input.graceDays ?? 0,
        now,
      });
      if (!subCheck.ok) {
        return subCheck;
      }
      return ok({ status: 'published', offerSideEffect: 'none' });
    }

    case 'published->matched': {
      if (actor !== 'merchant' || input.isOwnerMerchant !== true) {
        return err('UNAUTHORIZED_ACTOR');
      }
      return ok({ status: 'matched', offerSideEffect: 'accept_one_reject_others' });
    }

    case 'published->cancelled': {
      if (actor !== 'merchant' || input.isOwnerMerchant !== true) {
        return err('UNAUTHORIZED_ACTOR');
      }
      return ok({ status: 'cancelled', offerSideEffect: 'expire_all_pending' });
    }

    case 'published->expired': {
      if (actor !== 'system') {
        return err('UNAUTHORIZED_ACTOR');
      }
      if (!isRequestExpired('published', input.expiresAt, now)) {
        return err('INVALID_STATE_TRANSITION');
      }
      return ok({ status: 'expired', offerSideEffect: 'expire_all_pending' });
    }

    case 'matched->in_transit': {
      if (actor !== 'courier' || input.isAssignedCourier !== true) {
        return err('UNAUTHORIZED_ACTOR');
      }
      return ok({ status: 'in_transit', offerSideEffect: 'none' });
    }

    case 'matched->published': {
      const hasReason = Boolean(input.reason && input.reason.trim().length > 0);
      if (actor === 'merchant') {
        if (input.isOwnerMerchant !== true) return err('UNAUTHORIZED_ACTOR');
        if (!hasReason) return err('REASON_REQUIRED');
        return ok({ status: 'published', offerSideEffect: 'cancel_accepted' });
      }
      if (actor === 'courier') {
        if (input.isAssignedCourier !== true) return err('UNAUTHORIZED_ACTOR');
        if (!hasReason) return err('REASON_REQUIRED');
        return ok({ status: 'published', offerSideEffect: 'cancel_accepted' });
      }
      return err('UNAUTHORIZED_ACTOR');
    }

    case 'matched->cancelled': {
      if (actor !== 'merchant' || input.isOwnerMerchant !== true) {
        return err('UNAUTHORIZED_ACTOR');
      }
      if (!input.reason || input.reason.trim().length === 0) {
        return err('REASON_REQUIRED');
      }
      return ok({ status: 'cancelled', offerSideEffect: 'cancel_accepted' });
    }

    case 'in_transit->delivered': {
      if (actor !== 'courier' || input.isAssignedCourier !== true) {
        return err('UNAUTHORIZED_ACTOR');
      }
      return ok({ status: 'delivered', offerSideEffect: 'none' });
    }

    case 'in_transit->cancelled': {
      if (actor !== 'admin') {
        return err('UNAUTHORIZED_ACTOR');
      }
      if (!input.reason || input.reason.trim().length === 0) {
        return err('REASON_REQUIRED');
      }
      return ok({ status: 'cancelled', offerSideEffect: 'cancel_accepted' });
    }

    default:
      return err('INVALID_STATE_TRANSITION');
  }
}

export function canTransitionRequest(
  from: DeliveryRequestStatus,
  to: DeliveryRequestStatus,
  actor: RequestActor
): boolean {
  const sampleNow = new Date('2026-09-22T15:00:00.000Z');
  const samplePast = new Date('2026-09-22T14:00:00.000Z');
  const sampleFuture = new Date('2026-09-22T16:00:00.000Z');
  return transitionRequest({
    from,
    to,
    actor,
    now: sampleNow,
    expiresAt: to === 'expired' ? samplePast : sampleFuture,
    isOwnerMerchant: true,
    isAssignedCourier: true,
    subscriptionStatus: 'pilot',
    pilotActive: true,
    reason: 'motivo-valido',
  }).ok;
}

export function transitionOffer(
  from: OfferStatus,
  to: OfferStatus,
  actor: RequestActor
): ActionResult<OfferStatus, DomainErrorCode> {
  switch (`${from}->${to}`) {
    case 'pending->withdrawn':
      if (actor === 'courier' || actor === 'admin' || actor === 'system') {
        return ok('withdrawn');
      }
      return err('UNAUTHORIZED_ACTOR');
    case 'pending->accepted':
      if (actor === 'merchant') {
        return ok('accepted');
      }
      return err('UNAUTHORIZED_ACTOR');
    case 'pending->rejected':
      if (actor === 'system' || actor === 'merchant') {
        return ok('rejected');
      }
      return err('UNAUTHORIZED_ACTOR');
    case 'pending->expired':
      if (actor === 'system' || actor === 'merchant') {
        return ok('expired');
      }
      return err('UNAUTHORIZED_ACTOR');
    case 'accepted->cancelled':
      return ok('cancelled');
    default:
      return err('INVALID_STATE_TRANSITION');
  }
}

export function canTransitionOffer(
  from: OfferStatus,
  to: OfferStatus,
  actor: RequestActor
): boolean {
  return transitionOffer(from, to, actor).ok;
}

export interface CourierEligibilityInput {
  readonly status: CourierStatus;
  readonly available: boolean;
}

export function canCourierSubmitOffer(
  courier: CourierEligibilityInput
): ActionResult<true, DomainErrorCode> {
  if (courier.status === 'suspended') {
    return err('COURIER_SUSPENDED');
  }
  if (courier.status !== 'approved') {
    return err('COURIER_NOT_APPROVED');
  }
  if (!courier.available) {
    return err('COURIER_UNAVAILABLE');
  }
  return ok(true);
}

export function canCourierBeAccepted(
  courier: Pick<CourierEligibilityInput, 'status'>
): ActionResult<true, DomainErrorCode> {
  if (courier.status === 'suspended') {
    return err('COURIER_SUSPENDED');
  }
  if (courier.status !== 'approved') {
    return err('COURIER_NOT_APPROVED');
  }
  return ok(true);
}
