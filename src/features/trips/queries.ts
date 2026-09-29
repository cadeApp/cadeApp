import 'server-only';

import { createClient } from '@/server/supabase/server';
import { getTripDetailsServer } from '@/server/rpc/trips';
import type { TripDetails } from './types';

/**
 * Adaptador T-115 / T-117 sobre la frontera autoritativa de CC-008.
 * La autorización, revelación post-matched y procedencia del monto viven en
 * public.get_trip_details + getTripDetailsServer.
 * Las coordenadas y distancia calculada se proyectan post-matched vía RLS
 * sobre delivery_request_contacts y delivery_requests.
 */
export async function getTripDetails(requestId: string): Promise<TripDetails | null> {
  const result = await getTripDetailsServer({ requestId });
  if (!result.ok) return null;

  const trip = result.data;
  const supabase = await createClient();

  const [contactsResult, requestResult] = await Promise.all([
    supabase
      .from('delivery_request_contacts')
      .select('pickup_lat, pickup_lng, dropoff_lat, dropoff_lng')
      .eq('request_id', requestId)
      .maybeSingle<{
        pickup_lat: number | null;
        pickup_lng: number | null;
        dropoff_lat: number | null;
        dropoff_lng: number | null;
      }>(),
    supabase
      .from('delivery_requests')
      .select('route_distance_m')
      .eq('id', requestId)
      .maybeSingle<{
        route_distance_m: number | null;
      }>(),
  ]);

  const contacts = contactsResult.data;
  const request = requestResult.data;

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
    pickupLat: contacts?.pickup_lat != null ? Number(contacts.pickup_lat) : null,
    pickupLng: contacts?.pickup_lng != null ? Number(contacts.pickup_lng) : null,
    dropoffAddress: trip.dropoffAddress,
    dropoffZoneName: trip.dropoffZoneName,
    dropoffLat: contacts?.dropoff_lat != null ? Number(contacts.dropoff_lat) : null,
    dropoffLng: contacts?.dropoff_lng != null ? Number(contacts.dropoff_lng) : null,
    routeDistanceM: request?.route_distance_m != null ? Number(request.route_distance_m) : null,
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
