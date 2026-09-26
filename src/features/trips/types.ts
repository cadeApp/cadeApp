import type {
  RecipientPaymentMethod,
  VehicleType,
} from '@/domain';

export type TripStatus = 'matched' | 'in_transit' | 'delivered';

export interface TripDetails {
  id: string;
  code: string;
  status: TripStatus;
  merchantId: string;
  merchantName: string;
  merchantPhone: string | null;
  courierId: string;
  courierName: string;
  courierPhone: string | null;
  vehicleType: VehicleType | null;
  licensePlate: string | null;
  avatarUrl: string | null;
  amountArs: number;
  pickupAddress: string;
  pickupZoneName: string;
  dropoffAddress: string;
  dropoffZoneName: string;
  deliveryNotes: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientPaymentMethod: RecipientPaymentMethod;
  needsChange: boolean;
  cashChangeAmount: number | null;
  createdAt: string;
  matchedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
}
