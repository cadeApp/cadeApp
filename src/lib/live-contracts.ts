import { z } from 'zod';
import { packageTypeSchema, recipientPaymentMethodSchema } from '@/domain/schemas';
import { publicDropSummarySchema, type PublicDropSummary } from '@/domain/rpc-contracts';

export { publicDropSummarySchema, type PublicDropSummary };

export const liveAvailableRequestItemSchema = z.object({
  id: z.string().guid(),
  pickupZoneName: z.string().min(1),
  dropoffZoneName: z.string().min(1),
  approxDistanceKm: z.string().nullable(),
  packageType: packageTypeSchema,
  recipientPaymentMethod: recipientPaymentMethodSchema,
  needsChange: z.boolean(),
  publishedAt: z.string(),
  expiresAt: z.string().nullable(),
  hasMyOffer: z.boolean(),
  myOfferAmountArs: z.number().int().nullable(),
  fixedPriceArs: z.number().int().positive().nullable().optional(),
  autoAssign: z.boolean().optional(),
  dropsCount: z.number().int().positive().optional(),
  drops: z.array(publicDropSummarySchema).optional(),
});

export type LiveAvailableRequestItem = z.infer<typeof liveAvailableRequestItemSchema>;

export const liveMerchantOfferItemSchema = z.object({
  id: z.string().guid(),
  courierId: z.string().guid(),
  courierName: z.string().min(1),
  vehicleType: z.string().nullable(),
  amountArs: z.number().int().positive(),
  etaMinutes: z.number().int().positive(),
  message: z.string().nullable(),
  licenseStatus: z.enum(['none', 'submitted', 'verified', 'rejected']),
  insuranceStatus: z.enum(['none', 'submitted', 'verified', 'rejected']),
  docLevel: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  createdAt: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn']).optional(),
});

export type LiveMerchantOfferItem = z.infer<typeof liveMerchantOfferItemSchema>;

export const liveTripStateSchema = z.object({
  id: z.string().guid(),
  status: z.enum(['matched', 'in_transit', 'delivered']),
});

export type LiveTripState = z.infer<typeof liveTripStateSchema>;

export const livePageCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().guid(),
});

export type LivePageCursor = z.infer<typeof livePageCursorSchema>;

export const liveFeedResponseSchema = z.object({
  data: z.array(liveAvailableRequestItemSchema),
  nextCursor: livePageCursorSchema.nullable(),
});

export type LiveFeedResponse = z.infer<typeof liveFeedResponseSchema>;

export const liveOffersResponseSchema = z.object({
  data: z.array(liveMerchantOfferItemSchema),
  nextCursor: livePageCursorSchema.nullable(),
});

export type LiveOffersResponse = z.infer<typeof liveOffersResponseSchema>;

export const liveTripResponseSchema = z.object({
  data: liveTripStateSchema.nullable(),
});

export type LiveTripResponse = z.infer<typeof liveTripResponseSchema>;

export const liveErrorResponseSchema = z.object({
  error: z.string(),
});

export type LiveErrorResponse = z.infer<typeof liveErrorResponseSchema>;
