import type { DeliveryRequestStatus, RecipientPaymentMethod } from '@/domain';

export interface TripDetails {
  id: string;
  code: string;
  status: DeliveryRequestStatus;
  merchantId: string;
  courierId: string | null;
  courierName: string | null;
  vehicleType: string | null;
  licensePlate: string | null;
  avatarUrl: string | null;
  amountArs: number | null;
  pickupAddress: string;
  pickupZoneName: string;
  dropoffAddress: string | null;
  dropoffZoneName: string;
  deliveryNotes: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientPaymentMethod: RecipientPaymentMethod;
  needsChange: boolean;
  cashChangeAmount: number | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  createdAt: string;
  matchedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
}
