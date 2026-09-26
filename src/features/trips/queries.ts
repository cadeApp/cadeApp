import 'server-only';

import { getTripDetailsServer } from '@/server/rpc/trips';
import type { TripDetails } from './types';

/**
 * Adaptador T-115 sobre la frontera autoritativa de CC-008.
 * La autorización, revelación post-matched y procedencia del monto viven en
 * public.get_trip_details + getTripDetailsServer.
 */
export async function getTripDetails(requestId: string): Promise<TripDetails | null> {
  const result = await getTripDetailsServer({ requestId });
  if (!result.ok) return null;

  const trip = result.data;

  return {
    id: trip.requestId,
    code: trip.code,
    status: trip.status,
    merchantId: trip.merchantId,
    merchantName: trip.merchantName,
    merchantPhone: trip.merchantPhone,
    courierId: trip.courierId,
    courierName: trip.courierName,
    courierPhone: trip.courierPhone,
    vehicleType: trip.vehicleType,
    licensePlate: trip.vehiclePlate,
    avatarUrl: trip.avatarUrl,
    amountArs: trip.amountArs,
    pickupAddress: trip.pickupAddress,
    pickupZoneName: trip.pickupZoneName,
    dropoffAddress: trip.dropoffAddress,
    dropoffZoneName: trip.dropoffZoneName,
    deliveryNotes: trip.deliveryNotes,
    recipientName: trip.recipientName,
    recipientPhone: trip.recipientPhone,
    recipientPaymentMethod: trip.recipientPaymentMethod,
    needsChange: trip.needsChange,
    cashChangeAmount: trip.cashChangeAmount,
    createdAt: trip.createdAt,
    matchedAt: trip.matchedAt,
    pickedUpAt: trip.pickedUpAt,
    deliveredAt: trip.deliveredAt,
  };
}
