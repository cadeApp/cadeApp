import { z } from 'zod';

export const RequestPublishedPayloadSchema = z.object({
  event: z.literal('request_published'),
  requestId: z.string().uuid(),
});

export const OfferSubmittedPayloadSchema = z.object({
  event: z.literal('offer_submitted'),
  requestId: z.string().uuid(),
  offerId: z.string().uuid().optional(),
});

export const OfferAcceptedPayloadSchema = z.object({
  event: z.literal('offer_accepted'),
  requestId: z.string().uuid(),
  offerId: z.string().uuid().optional(),
});

export const RequestCancelledPayloadSchema = z.object({
  event: z.literal('request_cancelled'),
  requestId: z.string().uuid(),
});

export const RequestExpiredPayloadSchema = z.object({
  event: z.literal('request_expired'),
  requestId: z.string().uuid(),
});

export const PushNotificationPayloadSchema = z.discriminatedUnion('event', [
  RequestPublishedPayloadSchema,
  OfferSubmittedPayloadSchema,
  OfferAcceptedPayloadSchema,
  RequestCancelledPayloadSchema,
  RequestExpiredPayloadSchema,
]);

export type PushNotificationPayload = z.infer<typeof PushNotificationPayloadSchema>;
