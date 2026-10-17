import { z } from 'zod';
import { type ActionResult, type DomainErrorCode, err, ok } from './errors';
import {
  aguilaresLatSchema,
  aguilaresLngSchema,
  courierDocumentKindSchema,
  deliveryRequestStatusSchema,
  documentRejectionCodeSchema,
  documentReviewStatusSchema,
  incidentDecisionSchema,
  incidentDescriptionHasContact,
  incidentKindSchema,
  incidentStatusSchema,
  merchantSubscriptionStatusSchema,
  packageTypeSchema,
  platformSettingKeySchema,
  profileRoleSchema,
  recipientPaymentMethodSchema,
  vehicleTypeSchema,
} from './schemas';

export const uuidSchema = z.string().uuid();

export const isoTimestampSchema = z.string().datetime({ offset: true });

export const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (val) => {
      const y = Number(val.slice(0, 4));
      const m = Number(val.slice(5, 7));
      const d = Number(val.slice(8, 10));
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    },
    { message: 'VALIDATION_ERROR' }
  );

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

// CC-024: transactional multi-drop creation and publication.
const createAndPublishMultiDropDropInputSchema = z
  .object({
    dropoffZoneId: uuidSchema,
    dropoffAddress: z.string().trim().min(1).max(200),
    dropoffLat: aguilaresLatSchema.nullable(),
    dropoffLng: aguilaresLngSchema.nullable(),
    recipientName: z.string().trim().min(1).max(100),
    recipientPhone: z.string().trim().min(8).max(30),
    recipientConsentDeclared: z.literal(true),
    packageType: packageTypeSchema,
    recipientPaymentMethod: recipientPaymentMethodSchema,
    needsChange: z.boolean(),
    cashChangeAmount: z.number().int().positive().nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .strict()
  .superRefine((drop, ctx) => {
    if ((drop.dropoffLat === null) !== (drop.dropoffLng === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dropoffLat'],
        message: 'VALIDATION_ERROR',
      });
    }
    if (
      drop.recipientPaymentMethod === 'cash' &&
      drop.needsChange &&
      drop.cashChangeAmount === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cashChangeAmount'],
        message: 'VALIDATION_ERROR',
      });
    }
    if (drop.recipientPaymentMethod !== 'cash' && drop.needsChange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['needsChange'],
        message: 'VALIDATION_ERROR',
      });
    }
    if (
      (drop.recipientPaymentMethod !== 'cash' || !drop.needsChange) &&
      drop.cashChangeAmount !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cashChangeAmount'],
        message: 'VALIDATION_ERROR',
      });
    }
  });

export const createAndPublishMultiDropInputSchema = z
  .object({
    requestId: uuidSchema,
    pickupZoneId: uuidSchema,
    pickupAddress: z.string().trim().min(1).max(200),
    pickupLat: aguilaresLatSchema.nullable(),
    pickupLng: aguilaresLngSchema.nullable(),
    fixedPriceArs: z.number().int().positive().nullable(),
    autoAssign: z.boolean(),
    drops: z.array(createAndPublishMultiDropDropInputSchema).min(1),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if ((payload.pickupLat === null) !== (payload.pickupLng === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pickupLat'],
        message: 'VALIDATION_ERROR',
      });
    }
    if (payload.autoAssign && payload.fixedPriceArs === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixedPriceArs'],
        message: 'VALIDATION_ERROR',
      });
    }
  });

export const createAndPublishMultiDropOutputSchema = z
  .object({
    requestId: uuidSchema,
    status: deliveryRequestStatusSchema,
    publishedAt: isoTimestampSchema,
    expiresAt: isoTimestampSchema,
    routeDistanceM: z.number().int().nonnegative().nullable(),
    fixedPriceArs: z.number().int().min(1).nullable(),
    autoAssign: z.boolean(),
    dropsCount: z.number().int().min(1),
    idempotent: z.boolean(),
  })
  .strict();

// CC-026: el comercio no elige ámbito, estado ni reloj; la RPC deriva todo de la sesión y PostgreSQL.
export const reconcileExpiredRequestsInputSchema = z.object({}).strict();
const MERCHANT_RECONCILIATION_BATCH_LIMIT = 50;
export const reconcileExpiredRequestsOutputSchema = z
  .object({
    expiredRequestIds: z.array(uuidSchema),
    expiredCount: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  })
  .strict()
  .superRefine((output, ctx) => {
    if (output.expiredCount !== output.expiredRequestIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiredCount'],
        message: 'VALIDATION_ERROR',
      });
    }
    if (new Set(output.expiredRequestIds).size !== output.expiredRequestIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiredRequestIds'],
        message: 'VALIDATION_ERROR',
      });
    }
    if (output.expiredCount > MERCHANT_RECONCILIATION_BATCH_LIMIT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiredCount'],
        message: 'VALIDATION_ERROR',
      });
    }
  });

// 1. publish_request
export const publishRequestInputSchema = z.object({
  requestId: uuidSchema,
});
export const publishRequestOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('published'),
  publishedAt: isoTimestampSchema,
  expiresAt: isoTimestampSchema,
  routeDistanceM: z.number().int().nonnegative().nullable(),
  fixedPriceArs: z.number().int().min(1).nullable(),
  autoAssign: z.boolean(),
  dropsCount: z.number().int().min(1),
});

// take_request (CC-021)
export const takeRequestInputSchema = z.object({
  requestId: uuidSchema,
  etaMinutes: z.number().int().min(1).max(240),
  message: z.string().trim().max(280).nullable().optional(),
});
export const takeRequestOutputSchema = z.object({
  offerId: uuidSchema,
  requestId: uuidSchema,
  amountArs: z.number().int().min(1),
  totalAmountArs: z.number().int().min(1),
  offerStatus: z.enum(['pending', 'accepted']),
  requestStatus: z.enum(['published', 'matched']),
  matchedAt: isoTimestampSchema.nullable(),
  idempotent: z.boolean(),
});

// 2. cancel_request
export const cancelRequestInputSchema = z.object({
  requestId: uuidSchema,
  reason: z.string().trim().max(500).nullable().optional(),
});
export const cancelRequestOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('cancelled'),
  cancelledAt: isoTimestampSchema,
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
  totalAmountArs: z.number().int().min(1),
  createdAt: isoTimestampSchema,
});

// 4. withdraw_offer
export const withdrawOfferInputSchema = z.object({
  offerId: uuidSchema,
});
export const withdrawOfferOutputSchema = z.object({
  offerId: uuidSchema,
  status: z.literal('withdrawn'),
  decidedAt: isoTimestampSchema,
});

// 5. accept_offer
export const acceptOfferInputSchema = z.object({
  offerId: uuidSchema,
});
export const acceptOfferOutputSchema = z.object({
  requestId: uuidSchema,
  acceptedOfferId: uuidSchema,
  status: z.literal('matched'),
  matchedAt: isoTimestampSchema,
  idempotent: z.boolean(),
  totalAmountArs: z.number().int().min(1),
});

// mark_drop_delivered (CC-022)
export const markDropDeliveredInputSchema = z.object({
  dropId: uuidSchema,
});
export const markDropDeliveredOutputSchema = z.object({
  dropId: uuidSchema,
  requestId: uuidSchema,
  status: z.literal('delivered'),
  deliveredAt: isoTimestampSchema,
  requestStatus: deliveryRequestStatusSchema,
  idempotent: z.boolean(),
});

// mark_drop_failed (CC-022)
export const markDropFailedInputSchema = z.object({
  dropId: uuidSchema,
  reason: z.string().trim().max(500),
});
export const markDropFailedOutputSchema = z.object({
  dropId: uuidSchema,
  requestId: uuidSchema,
  status: z.literal('failed'),
  failedReason: z.string().trim().min(1).max(500),
  requestStatus: deliveryRequestStatusSchema,
  idempotent: z.boolean(),
});

// 6. mark_picked_up
export const markPickedUpInputSchema = z.object({
  requestId: uuidSchema,
});
export const markPickedUpOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('in_transit'),
  pickedUpAt: isoTimestampSchema,
});

// 7. mark_delivered
export const markDeliveredInputSchema = z.object({
  requestId: uuidSchema,
});
export const markDeliveredOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('delivered'),
  deliveredAt: isoTimestampSchema,
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
  expiresAt: isoTimestampSchema.nullable(),
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
  expiresAt: isoTimestampSchema,
});

// 10. republish_request
export const republishRequestInputSchema = z.object({
  requestId: uuidSchema,
  reason: z.string().trim().max(500).nullable().optional(),
});
export const republishRequestOutputSchema = z.object({
  requestId: uuidSchema,
  status: z.literal('published'),
  publishedAt: isoTimestampSchema,
  expiresAt: isoTimestampSchema,
});

// 11. report_incident
// CC-012: tipo canónico y relato sin datos de contacto; la RPC valida lo mismo en Postgres.
export const reportIncidentInputSchema = z.object({
  requestId: uuidSchema,
  kind: incidentKindSchema,
  description: z
    .string()
    .trim()
    .min(5)
    .max(1000)
    .refine((description) => !incidentDescriptionHasContact(description), {
      message: 'VALIDATION_ERROR',
    }),
});
export const reportIncidentOutputSchema = z.object({
  incidentId: uuidSchema,
  requestId: uuidSchema,
  status: incidentStatusSchema,
  createdAt: isoTimestampSchema,
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
const calculateRouteDistanceWithCoordsSchema = z.object({
  pickupLat: aguilaresLatSchema,
  pickupLng: aguilaresLngSchema,
  dropoffLat: aguilaresLatSchema,
  dropoffLng: aguilaresLngSchema,
  pickupZoneName: z.string().trim().min(1).max(120).optional(),
  dropoffZoneName: z.string().trim().min(1).max(120).optional(),
  pickupZoneId: uuidSchema.nullable().optional(),
  dropoffZoneId: uuidSchema.nullable().optional(),
});

const calculateRouteDistanceZoneOnlySchema = z.object({
  pickupLat: z.null().optional(),
  pickupLng: z.null().optional(),
  dropoffLat: z.null().optional(),
  dropoffLng: z.null().optional(),
  pickupZoneName: z.string().trim().min(1).max(120),
  dropoffZoneName: z.string().trim().min(1).max(120),
  pickupZoneId: uuidSchema.nullable().optional(),
  dropoffZoneId: uuidSchema.nullable().optional(),
});

export const calculateRouteDistanceInputSchema = z.union([
  calculateRouteDistanceWithCoordsSchema,
  calculateRouteDistanceZoneOnlySchema,
]);

export const calculateRouteDistanceOutputSchema = z.union([
  z.object({
    routeDistanceM: z.number().int().nonnegative(),
    displayLabel: z.string().trim().min(1).optional(),
  }),
  z.object({
    routeDistanceM: z.null(),
    displayLabel: z.string().regex(/^De barrio .+ a barrio .+$/),
  }),
]);

// Public drop projection for feed, offers, and live (CC-022 §3) — strictly NO PII
export const publicDropSummarySchema = z.object({
  position: z.number().int().min(1),
  dropoffZoneName: z.string().trim().min(1).max(120),
  packageType: packageTypeSchema,
  recipientPaymentMethod: recipientPaymentMethodSchema,
  needsChange: z.boolean(),
  approxDistanceM: z.number().int().nonnegative().nullable(),
});
export type PublicDropSummary = z.infer<typeof publicDropSummarySchema>;

// 14. get_trip_details (CC-008, CC-022)
export const getTripDetailsInputSchema = z.object({
  requestId: uuidSchema,
});

export const tripDropSchema = z.object({
  id: uuidSchema,
  position: z.number().int().min(1),
  dropoffZoneName: z.string().trim().min(1).max(120),
  dropoffAddress: z.string().trim().min(1),
  recipientName: z.string().trim().min(1),
  recipientPhone: z.string().trim().min(1),
  deliveryNotes: z.string().nullable(),
  cashChangeAmount: z.number().int().positive().nullable(),
  packageType: packageTypeSchema,
  recipientPaymentMethod: recipientPaymentMethodSchema,
  needsChange: z.boolean(),
  approxDistanceM: z.number().int().nonnegative().nullable(),
  status: z.enum(['pending', 'delivered', 'failed']),
  deliveredAt: isoTimestampSchema.nullable(),
  failedReason: z.string().nullable(),
  dropoffLat: aguilaresLatSchema.nullable(),
  dropoffLng: aguilaresLngSchema.nullable(),
});
export type TripDrop = z.infer<typeof tripDropSchema>;

export const getTripDetailsOutputSchema = z.object({
  requestId: uuidSchema,
  code: z.string().regex(/^REQ-[0-9A-F]{8}$/),
  status: z.enum(['matched', 'in_transit', 'delivered']),
  merchantId: uuidSchema,
  merchantName: z.string().trim().min(1).max(160),
  merchantPhone: z.string().trim().min(1).nullable(),
  courierId: uuidSchema,
  courierName: z.string().trim().min(1).max(160),
  courierPhone: z.string().trim().min(1).nullable(),
  vehicleType: vehicleTypeSchema.nullable(),
  vehiclePlate: z.string().trim().min(1).max(32).nullable(),
  amountArs: z.number().int().min(1),
  pickupAddress: z.string().trim().min(1),
  pickupZoneName: z.string().trim().min(1).max(120),
  dropoffAddress: z.string().trim().min(1),
  dropoffZoneName: z.string().trim().min(1).max(120),
  deliveryNotes: z.string().nullable(),
  recipientName: z.string().trim().min(1),
  recipientPhone: z.string().trim().min(1),
  recipientPaymentMethod: recipientPaymentMethodSchema,
  needsChange: z.boolean(),
  cashChangeAmount: z.number().int().positive().nullable(),
  createdAt: isoTimestampSchema,
  matchedAt: isoTimestampSchema.nullable(),
  pickedUpAt: isoTimestampSchema.nullable(),
  deliveredAt: isoTimestampSchema.nullable(),
  dropsCount: z.number().int().min(1),
  drops: z.array(tripDropSchema).min(1),
});

// 15. admin_decide_courier
// get_request_offer_couriers (CC-016)
// `.strict()`: un campo de más (teléfono, patente, dni_hmac, estado de aprobación) invalida la salida.
export const getRequestOfferCouriersInputSchema = z.object({
  requestId: uuidSchema,
});

export const requestOfferCourierSchema = z
  .object({
    courierId: uuidSchema,
    displayName: z.string(),
    vehicleType: vehicleTypeSchema.nullable(),
    licenseStatus: documentReviewStatusSchema,
    insuranceStatus: documentReviewStatusSchema,
    docLevel: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  })
  .strict();

export const getRequestOfferCouriersOutputSchema = z
  .object({
    requestId: uuidSchema,
    couriers: z.array(requestOfferCourierSchema),
  })
  .strict();

// get_merchant_request_private_fields (CC-023)
// Indicaciones y monto exacto de cambio de una solicitud propia, solo para el comercio dueño: con CC-023 esas
// columnas dejan de leerse por tabla. `.strict()`: un campo de más invalida la salida.
export const getMerchantRequestPrivateFieldsInputSchema = z.object({
  requestId: uuidSchema,
});

export const getMerchantRequestPrivateFieldsOutputSchema = z
  .object({
    requestId: uuidSchema,
    notes: z.string().nullable(),
    cashChangeAmount: z.number().int().positive().nullable(),
  })
  .strict();

export const adminDecideCourierInputSchema = z.object({
  courierId: uuidSchema,
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(500).nullable().optional(),
});
export const adminDecideCourierOutputSchema = z.object({
  courierId: uuidSchema,
  status: z.enum(['approved', 'rejected']),
  decidedAt: isoTimestampSchema,
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
  deactivatedAt: isoTimestampSchema,
});

// 16. admin_verify_document
export const adminVerifyDocumentInputSchema = z.object({
  documentId: uuidSchema,
  decision: z.enum(['verified', 'rejected']),
  reason: z.string().trim().max(500).nullable().optional(),
  rejectionCode: documentRejectionCodeSchema.nullable().optional(),
});
export const adminVerifyDocumentOutputSchema = z.object({
  documentId: uuidSchema,
  courierId: uuidSchema,
  kind: courierDocumentKindSchema,
  status: documentReviewStatusSchema,
  rejectionCode: documentRejectionCodeSchema.nullable().optional(),
  docLevel: z.number().int().min(0).max(2),
});

// CC-025: replace_courier_document
export const replaceCourierDocumentInputSchema = z.object({
  kind: courierDocumentKindSchema,
  storagePath: z.string().trim().min(1).max(500),
  idempotencyKey: uuidSchema.optional(),
});
export const replaceCourierDocumentOutputSchema = z.object({
  documentId: uuidSchema,
  kind: courierDocumentKindSchema,
  status: documentReviewStatusSchema,
  replacedDocumentId: uuidSchema.nullable(),
  isCurrent: z.boolean(),
  idempotent: z.boolean(),
});

// 17. admin_set_subscription
export const adminSetSubscriptionInputSchema = z.object({
  merchantId: uuidSchema,
  subscriptionStatus: merchantSubscriptionStatusSchema,
  paidUntil: civilDateSchema.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export const adminSetSubscriptionOutputSchema = z.object({
  merchantId: uuidSchema,
  subscriptionStatus: merchantSubscriptionStatusSchema,
  paidUntil: civilDateSchema.nullable(),
});

// 18. admin_update_setting
export const adminUpdateSettingInputSchema = z.discriminatedUnion('key', [
  z.object({
    key: z.literal('min_offer_ars'),
    value: z.number().int().min(1),
  }),
  z.object({
    key: z.literal('request_ttl_minutes'),
    value: z.number().int().min(1),
  }),
  z.object({
    key: z.literal('pilot_active'),
    value: z.boolean(),
  }),
  z.object({
    key: z.literal('pilot_terms_version'),
    value: z.string().trim().min(1),
  }),
  z.object({
    key: z.literal('subscription_grace_days'),
    value: z.number().int().min(0),
  }),
  z.object({
    key: z.literal('max_drops_per_request'),
    value: z.number().int().min(1),
  }),
  // CC-029 (T-369)
  z.object({
    key: z.literal('publication_drops_per_credit'),
    value: z.number().int().min(1).max(1000),
  }),
  z.object({
    key: z.literal('carryover_base_pct'),
    value: z.number().int().min(0).max(100),
  }),
  z.object({
    key: z.literal('carryover_step_pct'),
    value: z.number().int().min(0).max(100),
  }),
  z.object({
    key: z.literal('carryover_cap_pct'),
    value: z.number().int().min(0).max(100),
  }),
  z.object({
    key: z.literal('launch_discount_pct'),
    value: z.number().int().min(0).max(100),
  }),
  z.object({
    key: z.literal('loose_credit_reference_price_ars'),
    value: z.number().int().min(0).max(100_000_000),
  }),
]);
export const adminUpdateSettingOutputSchema = adminUpdateSettingInputSchema;

// 19. admin_resolve_incident (CC-012, D06-A): la RPC deriva el repartidor desde el incidente.
export const adminResolveIncidentInputSchema = z.object({
  incidentId: uuidSchema,
  decision: incidentDecisionSchema,
  reason: z.string().trim().min(1).max(500),
});
export const adminResolveIncidentOutputSchema = z.object({
  incidentId: uuidSchema,
  status: z.enum(['resolved', 'dismissed']),
  decision: incidentDecisionSchema,
  courierId: uuidSchema.nullable(),
  withdrawnOffersCount: z.number().int().nonnegative(),
});

// 20. admin_list_incidents (CC-012): bandeja A05 con keyset estable (created_at DESC, id DESC).
export const incidentsCursorSchema = z.object({
  createdAt: isoTimestampSchema,
  id: uuidSchema,
});
export type IncidentsCursor = z.infer<typeof incidentsCursorSchema>;
export const adminListIncidentsInputSchema = z.object({
  statuses: z.array(incidentStatusSchema).min(1).max(4),
  cursor: incidentsCursorSchema.nullable().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export const adminIncidentListItemSchema = z.object({
  id: uuidSchema,
  requestId: uuidSchema,
  kind: incidentKindSchema,
  description: z.string(),
  status: incidentStatusSchema,
  resolution: z.string().nullable(),
  createdAt: isoTimestampSchema,
  reporterId: uuidSchema,
  reporterRole: profileRoleSchema,
  reporterName: z.string(),
});
export const adminListIncidentsOutputSchema = z.object({
  items: z.array(adminIncidentListItemSchema),
  nextCursor: incidentsCursorSchema.nullable(),
});

// update_my_merchant_profile (CC-028)
export const updateMyMerchantProfileInputSchema = z
  .object({
    businessName: z.string().trim().min(1).max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, 'phone debe contener exactamente 10 dígitos numéricos.')
      .nullable()
      .optional(),
    defaultPickupAddress: z.string().trim().min(1).max(200).nullable().optional(),
    defaultPickupZoneId: uuidSchema.nullable().optional(),
    defaultPickupLat: aguilaresLatSchema.nullable().optional(),
    defaultPickupLng: aguilaresLngSchema.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'El patch debe contener al menos un campo a modificar.' }
  )
  .refine(
    (data) => (data.defaultPickupLat === undefined) === (data.defaultPickupLng === undefined),
    { message: 'Las coordenadas de latitud y longitud deben enviarse juntas.', path: ['defaultPickupLat'] }
  )
  .refine(
    (data) => (data.defaultPickupLat == null) === (data.defaultPickupLng == null),
    { message: 'Las coordenadas de latitud y longitud deben ser ambas numéricas o ambas nulas.', path: ['defaultPickupLat'] }
  );

export type UpdateMyMerchantProfileInput = z.infer<typeof updateMyMerchantProfileInputSchema>;

export const updateMyMerchantProfileOutputSchema = z.object({
  profileId: uuidSchema,
  businessName: z.string().min(1),
  phone: z.string().nullable(),
  defaultPickupAddress: z.string().nullable(),
  defaultPickupZoneId: uuidSchema.nullable(),
  defaultPickupLat: z.number().nullable(),
  defaultPickupLng: z.number().nullable(),
  notes: z.string().nullable(),
});

export type UpdateMyMerchantProfileOutput = z.infer<typeof updateMyMerchantProfileOutputSchema>;

// CC-029 (T-369): créditos de publicación y planes post-piloto
export const publicationPlanKindSchema = z.enum(['quota', 'unlimited']);
export const publicationLotKindSchema = z.enum(['loose', 'plan', 'carryover']);
export const publicationLotSourceSchema = z.enum(['purchase', 'adjustment', 'plan', 'carryover', 'refund_conversion']);
export const publicationModeSchema = z.enum(['pilot', 'legacy_paid', 'unlimited', 'credits']);
export const publicationMovementKindSchema = z.enum(['grant', 'reserve', 'consume', 'unconsume', 'release', 'convert']);
const publicationNoteSchema = z.string().trim().max(500).nullable().optional();
const launchDiscountPctSchema = z.number().int().min(0).max(100).nullable();

export const publicationPeriodSummarySchema = z.object({
  periodId: uuidSchema,
  planId: uuidSchema,
  planName: z.string().min(1),
  planKind: publicationPlanKindSchema,
  monthlyCredits: z.number().int().positive().nullable(),
  startsAt: isoTimestampSchema,
  endsAt: isoTimestampSchema,
  streak: z.number().int().min(1),
  carryoverPct: z.number().int().min(0).max(100),
});
export const publicationLotSummarySchema = z.object({
  lotId: uuidSchema,
  kind: publicationLotKindSchema,
  source: publicationLotSourceSchema,
  granted: z.number().int().positive(),
  available: z.number().int().nonnegative(),
  startsAt: isoTimestampSchema.nullable(),
  expiresAt: isoTimestampSchema.nullable(),
  usable: z.boolean(),
});
export const publicationBalanceSchema = z.object({
  merchantId: uuidSchema,
  mode: publicationModeSchema,
  canPublish: z.boolean(),
  subscriptionStatus: merchantSubscriptionStatusSchema,
  legacyPaidUntil: civilDateSchema.nullable(),
  available: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  scheduled: z.number().int().nonnegative(),
  currentPeriod: publicationPeriodSummarySchema.nullable(),
  nextPeriod: publicationPeriodSummarySchema.nullable(),
  lots: z.array(publicationLotSummarySchema),
});
export type PublicationBalance = z.infer<typeof publicationBalanceSchema>;

export const adminUpsertPublicationPlanInputSchema = z
  .object({
    planId: uuidSchema.nullable(),
    code: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/),
    name: z.string().trim().min(2).max(80),
    kind: publicationPlanKindSchema,
    monthlyCredits: z.number().int().min(1).max(100_000).nullable(),
    referencePriceArs: z.number().int().min(0).max(100_000_000).nullable(),
    active: z.boolean(),
    sort: z.number().int().min(0).max(1000),
  })
  .refine((data) => (data.kind === 'quota') === (data.monthlyCredits !== null), {
    message: 'Un plan con cupo lleva créditos mensuales; uno ilimitado, no.',
    path: ['monthlyCredits'],
  });
export const adminUpsertPublicationPlanOutputSchema = z.object({
  planId: uuidSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  kind: publicationPlanKindSchema,
  monthlyCredits: z.number().int().positive().nullable(),
  referencePriceArs: z.number().int().nonnegative().nullable(),
  active: z.boolean(),
  sort: z.number().int().nonnegative(),
});

export const adminGrantPublicationCreditsInputSchema = z.object({
  merchantId: uuidSchema,
  credits: z.number().int().min(1).max(10_000),
  source: z.enum(['purchase', 'adjustment']),
  operationKey: uuidSchema,
  note: publicationNoteSchema,
});
export const adminGrantPublicationCreditsOutputSchema = z.object({
  lotId: uuidSchema,
  merchantId: uuidSchema,
  credits: z.number().int().positive(),
  source: z.enum(['purchase', 'adjustment']),
  launchDiscountPct: launchDiscountPctSchema,
  idempotent: z.boolean(),
});

export const adminRegisterPlanPeriodInputSchema = z.object({
  merchantId: uuidSchema,
  planId: uuidSchema,
  isPurchase: z.boolean(),
  operationKey: uuidSchema,
  note: publicationNoteSchema,
});
export const adminRegisterPlanPeriodOutputSchema = z.object({
  periodId: uuidSchema,
  merchantId: uuidSchema,
  planId: uuidSchema,
  startsAt: isoTimestampSchema,
  endsAt: isoTimestampSchema,
  streak: z.number().int().min(1),
  carryoverPct: z.number().int().min(0).max(100),
  launchDiscountPct: launchDiscountPctSchema,
  idempotent: z.boolean(),
});

export const adminGetMerchantPublicationCreditsInputSchema = z.object({
  merchantId: uuidSchema,
  limit: z.number().int().min(1).max(50).optional(),
  beforeId: z.number().int().positive().nullable().optional(),
});
export const publicationMovementSchema = z.object({
  id: z.number().int().positive(),
  kind: publicationMovementKindSchema,
  amount: z.number().int().nonnegative(),
  lotId: uuidSchema.nullable(),
  chargeId: uuidSchema.nullable(),
  requestId: uuidSchema.nullable(),
  actorId: uuidSchema.nullable(),
  reason: z.string().nullable(),
  createdAt: isoTimestampSchema,
});
export const adminGetMerchantPublicationCreditsOutputSchema = z.object({
  balance: publicationBalanceSchema,
  movements: z.array(publicationMovementSchema),
  nextCursor: z.number().int().positive().nullable(),
});

export const getMyPublicationBalanceInputSchema = z.object({}).strict();
export const getMyPublicationBalanceOutputSchema = publicationBalanceSchema;

export const RPC_CONTRACTS = {
  update_my_merchant_profile: {
    inputSchema: updateMyMerchantProfileInputSchema,
    outputSchema: updateMyMerchantProfileOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'VALIDATION_ERROR',
      'OUT_OF_BOUNDS_AGUILARES',
      'NOT_FOUND',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  reconcile_expired_requests: {
    inputSchema: reconcileExpiredRequestsInputSchema,
    outputSchema: reconcileExpiredRequestsOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  create_and_publish_multi_drop: {
    inputSchema: createAndPublishMultiDropInputSchema,
    outputSchema: createAndPublishMultiDropOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'SUBSCRIPTION_INACTIVE',
      'PUBLICATION_CREDITS_EXHAUSTED',
      'MISSING_REQUIRED_FIELDS',
      'OUT_OF_BOUNDS_AGUILARES',
      'INVALID_ZONE',
      'INVALID_STATE_TRANSITION',
      'OFFER_BELOW_MINIMUM',
      'RATE_LIMITED',
      'DROP_LIMIT_EXCEEDED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  /**
   * Precedencia canónica del ciclo de solicitudes (CC-006 / D01 / D03 — compartida entre
   * `supabase/migrations/20260924010124_rpc_requests_v1.sql` y `src/domain/testing/rpc-fake.ts` para
   * `publish_request`, `cancel_request`, `mark_picked_up`, `mark_delivered`, `report_no_show`,
   * `courier_cancel_match`, `republish_request` y `report_incident`):
   *   1. Actor y rol (`UNAUTHENTICATED` → `UNAUTHORIZED_ACTOR` si el rol del perfil no está autorizado para la RPC;
   *      desde CC-012 `report_incident` rechaza siempre al admin y vive en su propia función SQL con esta misma precedencia)
   *   2. Parámetros de entrada (`VALIDATION_ERROR`: `requestId`, longitud de `reason`, `republish`, `kind` canónico,
   *      `description` sin datos de contacto — CC-012)
   *   3. Existencia de la solicitud (`NOT_FOUND`)
   *   4. Titularidad, participación y elegibilidad del actor:
   *      - Si `role = 'merchant'`: `UNAUTHORIZED_ACTOR` si `merchant_id <> auth.uid()`
   *      - Si `role = 'courier'` en `report_incident` (CC-002 §4 / H01): primero participación (`UNAUTHORIZED_ACTOR` si no es el repartidor de la oferta `accepted`) → luego elegibilidad (`NOT_FOUND` → `COURIER_SUSPENDED` → `COURIER_NOT_APPROVED`)
   *      - Si `role = 'courier'` en `mark_picked_up`, `mark_delivered`, `courier_cancel_match` (CC-002 §4): primero elegibilidad (`NOT_FOUND` → `COURIER_SUSPENDED` → `COURIER_NOT_APPROVED`) → luego pertenencia a la oferta `accepted` (`UNAUTHORIZED_ACTOR`)
   *   5. Estado efectivo (`published` con `expires_at <= now()` se evalúa como `'expired'` — H02) y transición:
   *      - `cancel_request` sobre solicitud vencida (`status = 'published'` y `expires_at <= now()`): `REQUEST_EXPIRED`
   *      - Estado efectivo inválido para la RPC y rol: `INVALID_STATE_TRANSITION` (`republish_request` admite `'matched' | 'expired' | 'cancelled'`, por lo que una `'published'` vencida es válida; `report_incident` admite, por CC-012 / D05-A, `'matched' | 'in_transit' | 'delivered'` al comercio dueño y `'matched' | 'in_transit'` al repartidor asignado)
   *      - `cancel_request` con `role = 'admin'` (ya en `in_transit`): `AAL2_REQUIRED` si `aal <> 'aal2'` (D03)
   *      - Motivo obligatorio vacío en `cancel_request` (`matched`/`in_transit`), `republish_request` (`matched`) o `courier_cancel_match`: `REASON_REQUIRED`
   *      - `cancel_request` administrativo sobre `in_transit` sin incidente registrado (CC-015): `INVALID_STATE_TRANSITION`
   *      - `report_no_show` sin oferta `accepted` válida: `INVALID_STATE_TRANSITION`
   *      - `report_incident` en `delivered` con `delivered_at is null` o `now() > delivered_at + 24h`: `INCIDENT_WINDOW_EXPIRED`
   *   6. Suscripción y gracia del comercio en `publish_request`, `republish_request` y `report_no_show(republish=true)` (`SUBSCRIPTION_INACTIVE`).
   *      CC-029: con `pilot_active = false` solo `cancelled` da `SUBSCRIPTION_INACTIVE`; `publish_request` y `republish_request`
   *      reservan el costo híbrido (legacy_paid → ilimitado → créditos) y sin derecho fallan con `PUBLICATION_CREDITS_EXHAUSTED`
   *      (después de validar contacto y zonas, antes del tope por ventana).
   *   7. Contacto, zonas activas y bordes de Aguilares en `publish_request` (`MISSING_REQUIRED_FIELDS` → `INVALID_ZONE` → `OUT_OF_BOUNDS_AGUILARES`)
   *   8. Tope por ventana de 1 min en `publish_request`/`republish_request` y `report_incident` (`RATE_LIMITED`)
   */
  publish_request: {
    inputSchema: publishRequestInputSchema,
    outputSchema: publishRequestOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'SUBSCRIPTION_INACTIVE',
      'PUBLICATION_CREDITS_EXHAUSTED',
      'MISSING_REQUIRED_FIELDS',
      'OUT_OF_BOUNDS_AGUILARES',
      'INVALID_ZONE',
      'INVALID_STATE_TRANSITION',
      'OFFER_BELOW_MINIMUM',
      'RATE_LIMITED',
      'DROP_LIMIT_EXCEEDED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  cancel_request: {
    inputSchema: cancelRequestInputSchema,
    outputSchema: cancelRequestOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'NOT_FOUND',
      'REQUEST_EXPIRED',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  /**
   * Precedencia canónica de errores de `submit_offer` (D05 / CC-001 / CC-021 §3 — compartida entre
   * migraciones y `src/domain/testing/rpc-fake.ts`):
   *   1. Actor, rol y consentimiento (CC-007): UNAUTHENTICATED → UNAUTHORIZED_ACTOR
   *   2. Repartidor (sin lock): NOT_FOUND → COURIER_SUSPENDED → COURIER_NOT_APPROVED → COURIER_UNAVAILABLE
   *   3. Parámetros de entrada: VALIDATION_ERROR
   *   4. Piso dinámico min_offer_ars: OFFER_BELOW_MINIMUM
   *   5. Solicitud (for update): NOT_FOUND → REQUEST_EXPIRED → INVALID_STATE_TRANSITION
   *   6. Precio fijo: FIXED_PRICE_REQUEST
   *   7. Oferta activa duplicada: DUPLICATE_ACTIVE_OFFER
   *   8. Repartidor (for share y nueva validación)
   *   9. Tope por ventana max_offers_per_min: RATE_LIMITED
   *  10. Mutación: crea oferta pending
   */
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
      'FIXED_PRICE_REQUEST',
      'OFFER_BELOW_MINIMUM',
      'DUPLICATE_ACTIVE_OFFER',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  /**
   * Precedencia canónica de errores de `take_request` (CC-021 §4):
   *   1. Actor, rol y consentimiento (CC-007): UNAUTHENTICATED → UNAUTHORIZED_ACTOR
   *   2. Repartidor (sin lock): NOT_FOUND → COURIER_SUSPENDED → COURIER_NOT_APPROVED → COURIER_UNAVAILABLE
   *   3. Parámetros de entrada: VALIDATION_ERROR
   *   4. Lock de la solicitud: NOT_FOUND
   *   5. Idempotencia: reintento propio devuelve éxito previo (idempotent: true)
   *   6. Estado de la solicitud: ALREADY_MATCHED (otro) → REQUEST_EXPIRED → INVALID_STATE_TRANSITION
   *   7. Sin precio fijo: NO_FIXED_PRICE
   *   8. Piso vigente: OFFER_BELOW_MINIMUM
   *   9. Oferta activa duplicada: DUPLICATE_ACTIVE_OFFER
   *  10. Lock del repartidor (for share y revalidación de elegibilidad)
   *  11. Tope por ventana max_offers_per_min: RATE_LIMITED
   *  12. Mutación (si auto_assign=true llama a app_private.match_offer; si auto_assign=false crea oferta pending)
   */
  take_request: {
    inputSchema: takeRequestInputSchema,
    outputSchema: takeRequestOutputSchema,
    errorCodes: [
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
    ] as const satisfies readonly DomainErrorCode[],
  },
  /**
   * Precedencia canónica de errores de `withdraw_offer` (H15 / CC-001 — compartida entre
   * `supabase/migrations/20260923050000_rpc_offers_v1.sql` y `src/domain/testing/rpc-fake.ts`):
   *   1. Actor y rol (`UNAUTHENTICATED` → `UNAUTHORIZED_ACTOR`)
   *   2. Parámetros de entrada (`VALIDATION_ERROR`: `offerId`)
   *   3. Oferta y titularidad (`NOT_FOUND` → `UNAUTHORIZED_ACTOR` si `courier_id <> auth.uid()`)
   *   4. Estado de la oferta (`OFFER_NOT_PENDING` si `status <> 'pending'`)
   *   5. Tope por ventana `max_offers_per_min` (`RATE_LIMITED`; se evalúa después del estado de la oferta, al revés que en `submit_offer`)
   */
  withdraw_offer: {
    inputSchema: withdrawOfferInputSchema,
    outputSchema: withdrawOfferOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'OFFER_NOT_PENDING',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  /**
   * Precedencia canónica de errores de `accept_offer` (CC-003 — compartida entre
   * `supabase/migrations/20260923170000_rpc_accept_offer_v1.sql` y `src/domain/testing/rpc-fake.ts`):
   *   1. Actor y rol (`UNAUTHENTICATED` → `UNAUTHORIZED_ACTOR`)
   *   2. Parámetros de entrada (`VALIDATION_ERROR`: `offerId`)
   *   3. Existencia de oferta, solicitud y repartidor (`NOT_FOUND`)
   *   4. Titularidad del comercio sobre la solicitud (`UNAUTHORIZED_ACTOR` si `merchant_id <> auth.uid()`)
   *   5. Idempotencia y competencia (`idempotent: true` si `status = 'matched'` y `accepted_offer_id = offerId` → `ALREADY_MATCHED` si `status = 'matched'` con otra oferta)
   *   6. Solicitud (`REQUEST_EXPIRED` si `status = 'published'` y `expires_at <= now()`, sin persistir transición → `INVALID_STATE_TRANSITION` si `status <> 'published'`)
   *   7. Estado de la oferta (`OFFER_NOT_PENDING` si `status <> 'pending'`)
   *   8. Elegibilidad del repartidor al aceptar (`COURIER_SUSPENDED` → `COURIER_NOT_APPROVED`)
   */
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
      'INTERNAL_ERROR',
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
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  mark_delivered: {
    inputSchema: markDeliveredInputSchema,
    outputSchema: markDeliveredOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'COURIER_NOT_APPROVED',
      'COURIER_SUSPENDED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  mark_drop_delivered: {
    inputSchema: markDropDeliveredInputSchema,
    outputSchema: markDropDeliveredOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'COURIER_SUSPENDED',
      'COURIER_NOT_APPROVED',
      'VALIDATION_ERROR',
      'INVALID_STATE_TRANSITION',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  mark_drop_failed: {
    inputSchema: markDropFailedInputSchema,
    outputSchema: markDropFailedOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'COURIER_SUSPENDED',
      'COURIER_NOT_APPROVED',
      'VALIDATION_ERROR',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'INTERNAL_ERROR',
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
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  courier_cancel_match: {
    inputSchema: courierCancelMatchInputSchema,
    outputSchema: courierCancelMatchOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'COURIER_NOT_APPROVED',
      'COURIER_SUSPENDED',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
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
      'PUBLICATION_CREDITS_EXHAUSTED',
      'REASON_REQUIRED',
      'INVALID_STATE_TRANSITION',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  report_incident: {
    inputSchema: reportIncidentInputSchema,
    outputSchema: reportIncidentOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'COURIER_NOT_APPROVED',
      'COURIER_SUSPENDED',
      'INCIDENT_WINDOW_EXPIRED',
      'INVALID_STATE_TRANSITION',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  /**
   * Precedencia canónica de errores de `set_availability` (H15 / CC-001 — compartida entre
   * `supabase/migrations/20260923050000_rpc_offers_v1.sql` y `src/domain/testing/rpc-fake.ts`):
   *   1. Actor y rol (`UNAUTHENTICATED` → `UNAUTHORIZED_ACTOR`)
   *   2. Parámetros de entrada (`VALIDATION_ERROR`: `available`)
   *   3. Repartidor y estado (`NOT_FOUND` → `COURIER_SUSPENDED` → `COURIER_NOT_APPROVED`)
   */
  set_availability: {
    inputSchema: setAvailabilityInputSchema,
    outputSchema: setAvailabilityOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'COURIER_NOT_APPROVED',
      'COURIER_SUSPENDED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  calculate_route_distance: {
    inputSchema: calculateRouteDistanceInputSchema,
    outputSchema: calculateRouteDistanceOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'OUT_OF_BOUNDS_AGUILARES',
      'INVALID_ZONE',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  get_trip_details: {
    inputSchema: getTripDetailsInputSchema,
    outputSchema: getTripDetailsOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  /**
   * CC-016: solo el comercio dueño de la solicitud. Solicitud inexistente o ajena responden igual
   * (`NOT_FOUND`) para no confirmar que el id existe.
   */
  get_request_offer_couriers: {
    inputSchema: getRequestOfferCouriersInputSchema,
    outputSchema: getRequestOfferCouriersOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  /**
   * CC-023: solo el comercio dueño, en cualquier estado de su solicitud. Solicitud inexistente o ajena
   * responden igual (`NOT_FOUND`). Repartidor y admin con sesión → `UNAUTHORIZED_ACTOR`.
   */
  get_merchant_request_private_fields: {
    inputSchema: getMerchantRequestPrivateFieldsInputSchema,
    outputSchema: getMerchantRequestPrivateFieldsOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
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
  replace_courier_document: {
    inputSchema: replaceCourierDocumentInputSchema,
    outputSchema: replaceCourierDocumentOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
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
      'INVALID_STATE_TRANSITION',
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
  /**
   * CC-012. Precedencia: UNAUTHENTICATED → UNAUTHORIZED_ACTOR → AAL2_REQUIRED → VALIDATION_ERROR →
   * REASON_REQUIRED → NOT_FOUND → INVALID_STATE_TRANSITION (incidente ya cerrado, o
   * `preventive_suspension` sin repartidor aceptado o con el repartidor ya suspendido).
   */
  admin_resolve_incident: {
    inputSchema: adminResolveIncidentInputSchema,
    outputSchema: adminResolveIncidentOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
      'REASON_REQUIRED',
      'NOT_FOUND',
      'INVALID_STATE_TRANSITION',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_list_incidents: {
    inputSchema: adminListIncidentsInputSchema,
    outputSchema: adminListIncidentsOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  // CC-029 (T-369). Precedencia de las RPC admin: UNAUTHENTICATED → UNAUTHORIZED_ACTOR → AAL2_REQUIRED →
  // VALIDATION_ERROR → NOT_FOUND → IDEMPOTENCY_CONFLICT / PLAN_INACTIVE / PLAN_IN_USE.
  admin_upsert_publication_plan: {
    inputSchema: adminUpsertPublicationPlanInputSchema,
    outputSchema: adminUpsertPublicationPlanOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'PLAN_IN_USE',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_grant_publication_credits: {
    inputSchema: adminGrantPublicationCreditsInputSchema,
    outputSchema: adminGrantPublicationCreditsOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'IDEMPOTENCY_CONFLICT',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_register_plan_period: {
    inputSchema: adminRegisterPlanPeriodInputSchema,
    outputSchema: adminRegisterPlanPeriodOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'IDEMPOTENCY_CONFLICT',
      'PLAN_INACTIVE',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  admin_get_merchant_publication_credits: {
    inputSchema: adminGetMerchantPublicationCreditsInputSchema,
    outputSchema: adminGetMerchantPublicationCreditsOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
  get_my_publication_balance: {
    inputSchema: getMyPublicationBalanceInputSchema,
    outputSchema: getMyPublicationBalanceOutputSchema,
    errorCodes: [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'INTERNAL_ERROR',
    ] as const satisfies readonly DomainErrorCode[],
  },
} as const;

export const ALL_RPC_NAMES = [
  'update_my_merchant_profile',
  'reconcile_expired_requests',
  'create_and_publish_multi_drop',
  'publish_request',
  'cancel_request',
  'submit_offer',
  'take_request',
  'withdraw_offer',
  'accept_offer',
  'mark_picked_up',
  'mark_delivered',
  'mark_drop_delivered',
  'mark_drop_failed',
  'report_no_show',
  'courier_cancel_match',
  'republish_request',
  'report_incident',
  'set_availability',
  'calculate_route_distance',
  'get_trip_details',
  'get_request_offer_couriers',
  'get_merchant_request_private_fields',
  'admin_decide_courier',
  'admin_suspend_courier',
  'admin_verify_document',
  'replace_courier_document',
  'admin_set_subscription',
  'admin_update_setting',
  'admin_resolve_incident',
  'admin_list_incidents',
  'admin_upsert_publication_plan',
  'admin_grant_publication_credits',
  'admin_register_plan_period',
  'admin_get_merchant_publication_credits',
  'get_my_publication_balance',
] as const satisfies readonly (keyof typeof RPC_CONTRACTS)[];

export type RpcName = (typeof ALL_RPC_NAMES)[number];
export type RpcInput<K extends RpcName> = z.infer<(typeof RPC_CONTRACTS)[K]['inputSchema']>;
export type RpcOutput<K extends RpcName> = z.infer<(typeof RPC_CONTRACTS)[K]['outputSchema']>;
export type RpcErrorCode<K extends RpcName> = (typeof RPC_CONTRACTS)[K]['errorCodes'][number];
export type RpcClientContract = {
  readonly [K in RpcName]: (
    input: RpcInput<K>
  ) => Promise<ActionResult<RpcOutput<K>, RpcErrorCode<K>>>;
};
