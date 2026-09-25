import { z } from 'zod';
import { type ActionResult, type DomainErrorCode, err, ok } from '../errors';

export const PROFILE_ROLES = ['merchant', 'courier', 'admin'] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];
export const profileRoleSchema = z.enum(PROFILE_ROLES);

export const SIGNUP_ROLES = ['merchant', 'courier'] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];
export const signupRoleSchema = z.enum(SIGNUP_ROLES);

export const MERCHANT_SUBSCRIPTION_STATUSES = ['pilot', 'active', 'expired', 'cancelled'] as const;
export type MerchantSubscriptionStatus = (typeof MERCHANT_SUBSCRIPTION_STATUSES)[number];
export const merchantSubscriptionStatusSchema = z.enum(MERCHANT_SUBSCRIPTION_STATUSES);

export const COURIER_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
export type CourierStatus = (typeof COURIER_STATUSES)[number];
export const courierStatusSchema = z.enum(COURIER_STATUSES);

export const VEHICLE_TYPES = ['walk', 'bike', 'moto', 'car'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export const vehicleTypeSchema = z.enum(VEHICLE_TYPES);

export const DOCUMENT_REVIEW_STATUSES = ['none', 'submitted', 'verified', 'rejected'] as const;
export type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];
export const documentReviewStatusSchema = z.enum(DOCUMENT_REVIEW_STATUSES);

export const COURIER_DOCUMENT_KINDS = [
  'dni_front',
  'dni_back',
  'selfie',
  'avatar',
  'license',
  'insurance',
] as const;
export type CourierDocumentKind = (typeof COURIER_DOCUMENT_KINDS)[number];
export const courierDocumentKindSchema = z.enum(COURIER_DOCUMENT_KINDS);

export const DELIVERY_REQUEST_STATUSES = [
  'draft',
  'published',
  'matched',
  'in_transit',
  'delivered',
  'cancelled',
  'expired',
] as const;
export type DeliveryRequestStatus = (typeof DELIVERY_REQUEST_STATUSES)[number];
export const deliveryRequestStatusSchema = z.enum(DELIVERY_REQUEST_STATUSES);

export const RECIPIENT_PAYMENT_METHODS = ['cash', 'transfer', 'to_agree'] as const;
export type RecipientPaymentMethod = (typeof RECIPIENT_PAYMENT_METHODS)[number];
export const recipientPaymentMethodSchema = z.enum(RECIPIENT_PAYMENT_METHODS);

export const PACKAGE_TYPES = ['sobre', 'chico', 'mediano', 'grande'] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];
export const packageTypeSchema = z.enum(PACKAGE_TYPES);

export const OFFER_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
  'expired',
  'cancelled',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export const offerStatusSchema = z.enum(OFFER_STATUSES);

export const CONSENT_DOCUMENTS = ['tos', 'privacy', 'courier_contract', 'pilot_terms'] as const;
export type ConsentDocument = (typeof CONSENT_DOCUMENTS)[number];
export const consentDocumentSchema = z.enum(CONSENT_DOCUMENTS);

export const CONSENT_STATUSES = ['pending', 'active', 'reconsent_required'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];
export const consentStatusSchema = z.enum(CONSENT_STATUSES);

export const INCIDENT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);

export const PLATFORM_SETTING_KEYS = [
  'min_offer_ars',
  'request_ttl_minutes',
  'pilot_active',
  'pilot_terms_version',
  'subscription_grace_days',
] as const;
export type PlatformSettingKey = (typeof PLATFORM_SETTING_KEYS)[number];
export const platformSettingKeySchema = z.enum(PLATFORM_SETTING_KEYS);

export const AGUILARES_BOUNDS = {
  minLat: -27.455,
  maxLat: -27.41,
  minLng: -65.64,
  maxLng: -65.595,
} as const;

export const AGUILARES_URBAN_DETOUR_FACTOR = 1.3;
export const ROUTE_DISTANCE_STEP_M = 500;
export const EARTH_RADIUS_M = 6_371_000;

export interface CoordinatePoint {
  readonly lat: number;
  readonly lng: number;
}

export function isWithinAguilaresBounds(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= AGUILARES_BOUNDS.minLat &&
    lat <= AGUILARES_BOUNDS.maxLat &&
    lng >= AGUILARES_BOUNDS.minLng &&
    lng <= AGUILARES_BOUNDS.maxLng
  );
}

export const aguilaresLatSchema = z
  .number()
  .finite()
  .min(AGUILARES_BOUNDS.minLat, 'OUT_OF_BOUNDS_AGUILARES')
  .max(AGUILARES_BOUNDS.maxLat, 'OUT_OF_BOUNDS_AGUILARES');

export const aguilaresLngSchema = z
  .number()
  .finite()
  .min(AGUILARES_BOUNDS.minLng, 'OUT_OF_BOUNDS_AGUILARES')
  .max(AGUILARES_BOUNDS.maxLng, 'OUT_OF_BOUNDS_AGUILARES');

export const aguilaresCoordPairSchema = z
  .object({
    lat: aguilaresLatSchema.nullable().optional(),
    lng: aguilaresLngSchema.nullable().optional(),
  })
  .refine((val) => (val.lat == null) === (val.lng == null), {
    message: 'Las coordenadas de latitud y longitud deben enviarse juntas o ambas nulas.',
    path: ['lat'],
  });

export function calculateHaversineRouteDistanceM(
  origin: CoordinatePoint,
  destination: CoordinatePoint
): number {
  if (origin.lat === destination.lat && origin.lng === destination.lng) {
    return 0;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(origin.lat)) *
      Math.cos(toRad(destination.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawMeters = EARTH_RADIUS_M * c * AGUILARES_URBAN_DETOUR_FACTOR;
  return Math.max(
    ROUTE_DISTANCE_STEP_M,
    Math.round(rawMeters / ROUTE_DISTANCE_STEP_M) * ROUTE_DISTANCE_STEP_M
  );
}

export function formatZoneToZoneDisplayLabel(
  pickupZoneName: string,
  dropoffZoneName: string
): string {
  return `De barrio ${pickupZoneName.trim()} a barrio ${dropoffZoneName.trim()}`;
}

export function validateRoutePointsAndCalculateDistanceM(
  origin: CoordinatePoint,
  destination: CoordinatePoint
): ActionResult<number, DomainErrorCode> {
  if (
    !isWithinAguilaresBounds(origin.lat, origin.lng) ||
    !isWithinAguilaresBounds(destination.lat, destination.lng)
  ) {
    return err('OUT_OF_BOUNDS_AGUILARES');
  }
  return ok(calculateHaversineRouteDistanceM(origin, destination));
}

export function createOfferAmountArsSchema(minOfferArs: number) {
  return z
    .number()
    .int('VALIDATION_ERROR')
    .min(1, 'OFFER_BELOW_MINIMUM')
    .min(minOfferArs, 'OFFER_BELOW_MINIMUM');
}
