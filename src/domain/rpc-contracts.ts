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
export const reportIncidentInputSchema = z.object({
  requestId: uuidSchema,
  kind: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(1000),
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

// 14. admin_decide_courier
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
]);
export const adminUpdateSettingOutputSchema = adminUpdateSettingInputSchema;

export const RPC_CONTRACTS = {
  /**
   * Precedencia canónica del ciclo de solicitudes (CC-006 / D01 / D03 — compartida entre
   * `supabase/migrations/20260924010124_rpc_requests_v1.sql` y `src/domain/testing/rpc-fake.ts` para
   * `publish_request`, `cancel_request`, `mark_picked_up`, `mark_delivered`, `report_no_show`,
   * `courier_cancel_match`, `republish_request` y `report_incident`):
   *   1. Actor y rol (`UNAUTHENTICATED` → `UNAUTHORIZED_ACTOR` si el rol del perfil no está autorizado para la RPC)
   *   2. Parámetros de entrada (`VALIDATION_ERROR`: `requestId`, longitud de `reason`, `republish`, `kind`, `description`)
   *   3. Existencia de la solicitud (`NOT_FOUND`)
   *   4. Titularidad, participación y elegibilidad del actor:
   *      - Si `role = 'merchant'`: `UNAUTHORIZED_ACTOR` si `merchant_id <> auth.uid()`
   *      - Si `role = 'courier'` en `report_incident` (CC-002 §4 / H01): primero participación (`UNAUTHORIZED_ACTOR` si no es el repartidor de la oferta `accepted`) → luego elegibilidad (`NOT_FOUND` → `COURIER_SUSPENDED` → `COURIER_NOT_APPROVED`)
   *      - Si `role = 'courier'` en `mark_picked_up`, `mark_delivered`, `courier_cancel_match` (CC-002 §4): primero elegibilidad (`NOT_FOUND` → `COURIER_SUSPENDED` → `COURIER_NOT_APPROVED`) → luego pertenencia a la oferta `accepted` (`UNAUTHORIZED_ACTOR`)
   *   5. Estado efectivo (`published` con `expires_at <= now()` se evalúa como `'expired'` — H02) y transición:
   *      - `cancel_request` sobre solicitud vencida (`status = 'published'` y `expires_at <= now()`): `REQUEST_EXPIRED`
   *      - Estado efectivo inválido para la RPC y rol: `INVALID_STATE_TRANSITION` (`republish_request` admite `'matched' | 'expired' | 'cancelled'`, por lo que una `'published'` vencida es válida; `report_incident` admite `'published' | 'matched' | 'in_transit' | 'delivered'` vigentes, por lo que una `'published'` vencida da `INVALID_STATE_TRANSITION`)
   *      - `cancel_request` con `role = 'admin'` (ya en `in_transit`): `AAL2_REQUIRED` si `aal <> 'aal2'` (D03)
   *      - Motivo obligatorio vacío en `cancel_request` (`matched`/`in_transit`), `republish_request` (`matched`) o `courier_cancel_match`: `REASON_REQUIRED`
   *      - `report_no_show` sin oferta `accepted` válida: `INVALID_STATE_TRANSITION`
   *      - `report_incident` en `delivered` con `delivered_at is null` o `now() > delivered_at + 24h`: `INCIDENT_WINDOW_EXPIRED`
   *   6. Suscripción y gracia del comercio en `publish_request`, `republish_request` y `report_no_show(republish=true)` (`SUBSCRIPTION_INACTIVE`)
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
      'MISSING_REQUIRED_FIELDS',
      'OUT_OF_BOUNDS_AGUILARES',
      'INVALID_ZONE',
      'INVALID_STATE_TRANSITION',
      'RATE_LIMITED',
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
   * Precedencia canónica de errores de `submit_offer` (D05 / CC-001 — compartida entre
   * `supabase/migrations/20260923050000_rpc_offers_v1.sql` y `src/domain/testing/rpc-fake.ts`):
   *   1. Actor y rol (`UNAUTHENTICATED` → `UNAUTHORIZED_ACTOR`)
   *   2. Repartidor (`NOT_FOUND` → `COURIER_SUSPENDED` → `COURIER_NOT_APPROVED` → `COURIER_UNAVAILABLE`)
   *   3. Parámetros de entrada (`VALIDATION_ERROR`: `requestId`, `amountArs`, `etaMinutes`, `message`)
   *   4. Piso dinámico `min_offer_ars` (`OFFER_BELOW_MINIMUM`)
   *   5. Tope por ventana `max_offers_per_min` (`RATE_LIMITED`)
   *   6. Solicitud (`NOT_FOUND` → `REQUEST_EXPIRED` → `INVALID_STATE_TRANSITION`)
   *   7. Oferta activa duplicada (`DUPLICATE_ACTIVE_OFFER`)
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
      'OFFER_BELOW_MINIMUM',
      'DUPLICATE_ACTIVE_OFFER',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
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
  ) => Promise<ActionResult<RpcOutput<K>, RpcErrorCode<K>>>;
};
