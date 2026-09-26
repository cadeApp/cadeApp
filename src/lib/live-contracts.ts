import { z } from 'zod';

export const liveAvailableRequestItemSchema = z.object({
  id: z.string().uuid(),
  pickupZoneName: z.string().min(1),
  dropoffZoneName: z.string().min(1),
  approxDistanceKm: z.string(),
  packageType: z.enum(['small', 'medium', 'large']),
  recipientPaymentMethod: z.enum(['cash', 'transfer']),
  needsChange: z.boolean(),
  cashChangeAmount: z.number().int().nullable(),
  notes: z.string().nullable(),
  publishedAt: z.string(),
  expiresAt: z.string().nullable(),
  hasMyOffer: z.boolean(),
  myOfferAmountArs: z.number().int().nullable(),
});

export type LiveAvailableRequestItem = z.infer<typeof liveAvailableRequestItemSchema>;

export const liveMerchantOfferItemSchema = z.object({
  id: z.string().uuid(),
  courierId: z.string().uuid(),
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
  id: z.string().uuid(),
  status: z.enum(['matched', 'in_transit', 'delivered']),
});

export type LiveTripState = z.infer<typeof liveTripStateSchema>;

export const liveFeedResponseSchema = z.object({
  data: z.array(liveAvailableRequestItemSchema),
});

export type LiveFeedResponse = z.infer<typeof liveFeedResponseSchema>;

export const liveOffersResponseSchema = z.object({
  data: z.array(liveMerchantOfferItemSchema),
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
