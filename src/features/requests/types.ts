import type { DeliveryRequestStatus, PackageType, RecipientPaymentMethod } from '@/domain/schemas';
import type { DocLevel, OfferSortOrder } from '@/domain/priority';

export type { DocLevel, OfferSortOrder };

export interface MerchantOfferItem {
  readonly id: string;
  readonly courierId: string;
  readonly courierName: string;
  readonly vehicleType: string | null;
  readonly amountArs: number;
  readonly etaMinutes: number;
  readonly message: string | null;
  readonly licenseStatus: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly insuranceStatus: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly docLevel: DocLevel;
  readonly createdAt: string;
  readonly status?: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
}

export interface MerchantRequestSummary {
  readonly id: string;
  readonly pickupZoneName: string;
  readonly dropoffZoneName: string;
  readonly approxDistanceKm: string | null;
  readonly packageType: PackageType;
  readonly recipientPaymentMethod: RecipientPaymentMethod;
  readonly needsChange: boolean;
  readonly cashChangeAmount: number | null;
  readonly status: DeliveryRequestStatus;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly offersCount: number;
  readonly acceptedOfferId: string | null;
}

export interface MerchantRequestDetail {
  readonly id: string;
  readonly pickupZoneName: string;
  readonly dropoffZoneName: string;
  readonly approxDistanceKm: string | null;
  readonly packageType: PackageType;
  readonly recipientPaymentMethod: RecipientPaymentMethod;
  readonly needsChange: boolean;
  readonly cashChangeAmount: number | null;
  readonly notes: string | null;
  readonly status: DeliveryRequestStatus;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly acceptedOfferId: string | null;
  readonly pickupAddress?: string;
  readonly dropoffAddress?: string;
  readonly recipientName?: string;
  readonly recipientPhone?: string;
}

export interface MerchantMetrics {
  readonly dispatchedToday: number;
  readonly avgRateArs: number;
  readonly activeCount: number;
}
