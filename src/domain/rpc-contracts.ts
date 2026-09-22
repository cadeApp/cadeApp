import { z } from 'zod';
import { type ActionResult, type DomainErrorCode, err, ok } from './errors';
import {
  aguilaresLatSchema,
  aguilaresLngSchema,
  courierDocumentKindSchema,
  documentReviewStatusSchema,
  incidentStatusSchema,
  merchantSubscriptionStatusSchema,
  platformSettingKeySchema,
} from './schemas';

export const uuidSchema = z.string().uuid();

export function validateOfferAmountAgainstFloor(
  amountArs: number,
  minOfferArs: number
): ActionResult<number, DomainErrorCode> {
  if (!Number.isInteger(amountArs) || !Number.isInteger(minOfferArs) || minOfferArs < 1) {
    return err('VALIDATION_ERROR');
  }
  if (amountArs < 1 || amountArs < minOfferArs) {
    return err('OFFER_BELOW_MINIMUM');
  }
  return ok(amountArs);
}

// 1. publish_request
export const publishRequestInputSchema = z.object({
  requestId: uuidSchema,
});
export const publishRequestOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('published'),
  publishedAt: z.string(),
  expiresAt: z.string(),
  routeDistanceM: z.number().int().nonnegative(),
});

// 2. cancel_request
export const cancelRequestInputSchema = z.object({
  requestId: uuidSchema,
  reason: z.string().trim().max(500).nullable().optional(),
});
export const cancelRequestOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('cancelled'),
  cancelledAt: z.string(),
});

// 3. submit_offer
export const submitOfferInputSchema = z.object({
  requestId: uuidSchema,
  amountArs: z.number().int().min(1),
  etaMinutes: z.number().int().min(1).max(240),
  message: z.string().trim().max(280).nullable().optional(),
});
export const submitOfferOutputSchema = z.object({
  offerId: uuidSchema,
  requestId: uuidSchema,
  status: z.literal('pending'),
  amountArs: z.number().int().min(1),
  createdAt: z.string(),
});

// 4. withdraw_offer
export const withdrawOfferInputSchema = z.object({
  offerId: uuidSchema,
});
export const withdrawOfferOutputSchema = z.object({
  offerId: uuidSchema,
  status: z.literal('withdrawn'),
  decidedAt: z.string(),
});

// 5. accept_offer
export const acceptOfferInputSchema = z.object({
  offerId: uuidSchema,
});
export const acceptOfferOutputSchema = z.object({
  requestId: uuidSchema,
  acceptedOfferId: uuidSchema,
  status: z.literal('matched'),
  matchedAt: z.string(),
  idempotent: z.boolean(),
});

// 6. mark_picked_up
export const markPickedUpInputSchema = z.object({
  requestId: uuidSchema,
});
export const markPickedUpOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('in_transit'),
  pickedUpAt: z.string(),
});

// 7. mark_delivered
export const markDeliveredInputSchema = z.object({
  requestId: uuidSchema,
});
export const markDeliveredOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('delivered'),
  deliveredAt: z.string(),
});

// 8. report_no_show
export const reportNoShowInputSchema = z.object({
  requestId: uuidSchema,
  republish: z.boolean().optional(),
});
export const reportNoShowOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.enum(['published', 'cancelled']),
  cancelledOfferId: uuidSchema,
  expiresAt: z.string().nullable(),
});

// 9. courier_cancel_match
export const courierCancelMatchInputSchema = z.object({
  requestId: uuidSchema,
  reason: z.string().trim().min(1).max(500),
});
export const courierCancelMatchOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('published'),
  cancelledOfferId: uuidSchema,
  expiresAt: z.string(),
});

// 10. republish_request
export const republishRequestInputSchema = z.object({
  requestId: uuidSchema,
  reason: z.string().trim().max(500).nullable().optional(),
});
export const republishRequestOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('published'),
  publishedAt: z.string(),
  expiresAt: z.string(),
});

// 11. report_incident
export const reportIncidentInputSchema = z.object({
  requestId: uuidSchema,
  kind: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(1000),
});
export const reportIncidentOutputSchema = z.object({
  incidentId: uuidSchema,
  requestId: uuidSchema,
  status: incidentStatusSchema,
  createdAt: z.string(),
});

// 12. set_availability
export const setAvailabilityInputSchema = z.object({
  available: z.boolean(),
});
export const setAvailabilityOutputSchema = z.object({
  courierId: uuidSchema,
  available: z.boolean(),
});

// 13. calculate_route_distance
export const calculateRouteDistanceInputSchema = z.object({
  pickupLat: aguilaresLatSchema.nullable().optional(),
  pickupLng: aguilaresLngSchema.nullable().optional(),
  dropoffLat: aguilaresLatSchema.nullable().optional(),
  dropoffLng: aguilaresLngSchema.nullable().optional(),
  pickupZoneId: uuidSchema.nullable().optional(),
  dropoffZoneId: uuidSchema.nullable().optional(),
});
export const calculateRouteDistanceOutputSchema = z.object({
  routeDistanceM: z.number().int().positive(),
  usedZoneFallback: z.boolean(),
});

// 14. admin_decide_courier
export const adminDecideCourierInputSchema = z.object({
  courierId: uuidSchema,
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(500).nullable().optional(),
});
export const adminDecideCourierOutputSchema = z.object({
  courierId: uuidSchema,
  status: z.enum(['approved', 'rejected']),
  decidedAt: z.string(),
});

// 15. admin_suspend_courier
export const adminSuspendCourierInputSchema = z.object({
  courierId: uuidSchema,
  reason: z.string().trim().min(1).max(500),
});
export const adminSuspendCourierOutputSchema = z.object({
  courierId: uuidSchema,
  status: z.literal('suspended'),
  withdrawnOffersCount: z.number().int().nonnegative(),
  deactivatedAt: z.string(),
});

// 16. admin_verify_document
export const adminVerifyDocumentInputSchema = z.object({
  documentId: uuidSchema,
  decision: z.enum(['verified', 'rejected']),
  reason: z.string().trim().max(500).nullable().optional(),
});
export const adminVerifyDocumentOutputSchema = z.object({
  documentId: uuidSchema,
  courierId: uuidSchema,
  kind: courierDocumentKindSchema,
  status: documentReviewStatusSchema,
  docLevel: z.number().int().min(0).max(2),
});

// 17. admin_set_subscription
export const adminSetSubscriptionInputSchema = z.object({
  merchantId: uuidSchema,
  subscriptionStatus: merchantSubscriptionStatusSchema,
  paidUntil: z.string().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export const adminSetSubscriptionOutputSchema = z.object({
  merchantId: uuidSchema,
  subscriptionStatus: merchantSubscriptionStatusSchema,
  paidUntil: z.string().nullable(),
});

// 18. admin_update_setting
export const adminUpdateSettingInputSchema = z.object({
  key: platformSettingKeySchema,
  value: z.union([z.number().int().nonnegative(), z.boolean(), z.string().min(1)]),
});
export const adminUpdateSettingOutputSchema = z.object({
  key: platformSettingKeySchema,
  value: z.union([z.number().int().nonnegative(), z.boolean(), z.string()]),
});

export const RPC_CONTRACTS = {
  publish_request: {
    inputSchema: publishRequestInputSchema,
    outputSchema: publishRequestOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'SUBSCRIPTION_INACTIVE',
      'MISSING_REQUIRED_FIELDS',
      'OUT_OF_BOUNDS_AGUILARES',
      'INVALID_ZONE',
      'INVALID_STATE_TRANSITION',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  cancel_request: {
    inputSchema: cancelRequestInputSchema,
    outputSchema: cancelRequestOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'REQUEST_EXPIRED',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  submit_offer: {
    inputSchema: submitOfferInputSchema,
    outputSchema: submitOfferOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'COURIER_NOT_APPROVED',
      'COURIER_SUSPENDED',
      'COURIER_UNAVAILABLE',
      'REQUEST_EXPIRED',
      'INVALID_STATE_TRANSITION',
      'OFFER_BELOW_MINIMUM',
      'DUPLICATE_ACTIVE_OFFER',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  withdraw_offer: {
    inputSchema: withdrawOfferInputSchema,
    outputSchema: withdrawOfferOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'OFFER_NOT_PENDING',
      'INVALID_STATE_TRANSITION',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  accept_offer: {
    inputSchema: acceptOfferInputSchema,
    outputSchema: acceptOfferOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'REQUEST_EXPIRED',
      'ALREADY_MATCHED',
      'OFFER_NOT_PENDING',
      'COURIER_NOT_APPROVED',
      'COURIER_SUSPENDED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  mark_picked_up: {
    inputSchema: markPickedUpInputSchema,
    outputSchema: markPickedUpOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'COURIER_NOT_APPROVED',
      'COURIER_SUSPENDED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  mark_delivered: {
    inputSchema: markDeliveredInputSchema,
    outputSchema: markDeliveredOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  report_no_show: {
    inputSchema: reportNoShowInputSchema,
    outputSchema: reportNoShowOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'SUBSCRIPTION_INACTIVE',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  courier_cancel_match: {
    inputSchema: courierCancelMatchInputSchema,
    outputSchema: courierCancelMatchOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  republish_request: {
    inputSchema: republishRequestInputSchema,
    outputSchema: republishRequestOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'SUBSCRIPTION_INACTIVE',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  report_incident: {
    inputSchema: reportIncidentInputSchema,
    outputSchema: reportIncidentOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'INCIDENT_WINDOW_EXPIRED',
      'INVALID_STATE_TRANSITION',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  set_availability: {
    inputSchema: setAvailabilityInputSchema,
    outputSchema: setAvailabilityOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'COURIER_NOT_APPROVED',
      'COURIER_SUSPENDED',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  calculate_route_distance: {
    inputSchema: calculateRouteDistanceInputSchema,
    outputSchema: calculateRouteDistanceOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'OUT_OF_BOUNDS_AGUILARES',
      'INVALID_ZONE',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_decide_courier: {
    inputSchema: adminDecideCourierInputSchema,
    outputSchema: adminDecideCourierOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'NOT_FOUND',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_suspend_courier: {
    inputSchema: adminSuspendCourierInputSchema,
    outputSchema: adminSuspendCourierOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'NOT_FOUND',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_verify_document: {
    inputSchema: adminVerifyDocumentInputSchema,
    outputSchema: adminVerifyDocumentOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'NOT_FOUND',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_set_subscription: {
    inputSchema: adminSetSubscriptionInputSchema,
    outputSchema: adminSetSubscriptionOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'NOT_FOUND',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_update_setting: {
    inputSchema: adminUpdateSettingInputSchema,
    outputSchema: adminUpdateSettingOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'INVALID_SETTING_KEY',
      'INVALID_SETTING_VALUE',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
} as const;

export const ALL_RPC_NAMES = [
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
] as const satisfies readonly (keyof typeof RPC_CONTRACTS)[];

export type RpcName = (typeof ALL_RPC_NAMES)[number];
export type RpcInput<K extends RpcName> = z.infer<(typeof RPC_CONTRACTS)[K]['inputSchema']>;
export type RpcOutput<K extends RpcName> = z.infer<(typeof RPC_CONTRACTS)[K]['outputSchema']>;
export type RpcErrorCode<K extends RpcName> = (typeof RPC_CONTRACTS)[K]['errorCodes'][number];
export type RpcClientContract = {
  readonly [K in RpcName]: (
    input: RpcInput<K>
  ) => Promise<ActionResult<RpcOutput<K>, DomainErrorCode>>;
};
