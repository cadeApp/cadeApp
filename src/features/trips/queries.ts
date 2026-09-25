import { createClient } from '@/server/supabase/server';
import type { TripDetails } from './types';
import type { DeliveryRequestStatus } from '@/domain';

interface RawOfferItem {
  id: string;
  courier_id: string;
  amount_ars: number;
  status: string;
  courier?: {
    display_name?: string | null;
    vehicle_type?: string | null;
    vehicle_plate?: string | null;
    avatar_url?: string | null;
  } | Array<{
    display_name?: string | null;
    vehicle_type?: string | null;
    vehicle_plate?: string | null;
    avatar_url?: string | null;
  }> | null;
}

interface RawContactItem {
  recipient_name?: string | null;
  recipient_phone?: string | null;
  dropoff_address?: string | null;
  delivery_notes?: string | null;
}

interface RawDeliveryRequestDbRow {
  id: string;
  code: string;
  merchant_id: string;
  status: DeliveryRequestStatus;
  pickup_address: string;
  pickup_zone_id: string;
  dropoff_zone_id: string;
  pickup_zone?: { name?: string | null } | Array<{ name?: string | null }> | null;
  dropoff_zone?: { name?: string | null } | Array<{ name?: string | null }> | null;
  package_type: string;
  recipient_payment_method: 'cash' | 'transfer' | 'to_agree';
  needs_change: boolean;
  cash_change_amount: number | null;
  accepted_offer_id: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  created_at: string;
  matched_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  contacts?: RawContactItem | RawContactItem[] | null;
  offers?: RawOfferItem[] | null;
}

/**
 * Consulta del viaje activo con revelación progresiva y procedencia estricta de oferta aceptada (H09).
 */
export async function getTripDetails(requestId: string): Promise<TripDetails | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: row, error } = await supabase
    .from('delivery_requests')
    .select(`
      id,
      code,
      merchant_id,
      status,
      pickup_address,
      pickup_zone_id,
      dropoff_zone_id,
      pickup_zone:pickup_zone_id(name),
      dropoff_zone:dropoff_zone_id(name),
      package_type,
      recipient_payment_method,
      needs_change,
      cash_change_amount,
      accepted_offer_id,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      created_at,
      matched_at,
      picked_up_at,
      delivered_at,
      contacts:delivery_request_contacts(
        recipient_name,
        recipient_phone,
        dropoff_address,
        delivery_notes
      ),
      offers(
        id,
        courier_id,
        amount_ars,
        status,
        courier:profiles!courier_id(
          display_name,
          vehicle_type,
          vehicle_plate,
          avatar_url
        )
      )
    `)
    .eq('id', requestId)
    .maybeSingle<RawDeliveryRequestDbRow>();

  if (error || !row) {
    return null;
  }

  // 1. Identificar la oferta aceptada atómicamente por accepted_offer_id
  const rawOffers: RawOfferItem[] = Array.isArray(row.offers) ? row.offers : [];
  const acceptedOffer = row.accepted_offer_id
    ? rawOffers.find((o) => o.id === row.accepted_offer_id)
    : undefined;

  const assignedCourierId = acceptedOffer?.courier_id ?? null;

  // 2. Control de acceso: solo el comercio propietario o el repartidor asignado pueden consultar
  const isMerchant = user.id === row.merchant_id;
  const isAssignedCourier = assignedCourierId !== null && user.id === assignedCourierId;

  if (!isMerchant && !isAssignedCourier) {
    return null;
  }

  // 3. Revelación progresiva (D3 / D15):
  // Solo se exponen contactos y dirección exacta tras matched
  const isPostMatched = ['matched', 'in_transit', 'delivered'].includes(row.status);

  const rawContacts: RawContactItem | undefined = Array.isArray(row.contacts)
    ? row.contacts[0]
    : (row.contacts ?? undefined);

  const rawCourier = Array.isArray(acceptedOffer?.courier)
    ? acceptedOffer?.courier[0]
    : acceptedOffer?.courier;

  const pickupZoneName = Array.isArray(row.pickup_zone)
    ? (row.pickup_zone[0]?.name ?? '')
    : (row.pickup_zone?.name ?? '');

  const dropoffZoneName = Array.isArray(row.dropoff_zone)
    ? (row.dropoff_zone[0]?.name ?? '')
    : (row.dropoff_zone?.name ?? '');

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    merchantId: row.merchant_id,
    courierId: assignedCourierId,
    courierName: rawCourier?.display_name ?? null,
    vehicleType: rawCourier?.vehicle_type ?? null,
    licensePlate: rawCourier?.vehicle_plate ?? null,
    avatarUrl: rawCourier?.avatar_url ?? null,
    amountArs: acceptedOffer ? acceptedOffer.amount_ars : null,
    pickupAddress: row.pickup_address,
    pickupZoneName,
    dropoffAddress: isPostMatched ? (rawContacts?.dropoff_address ?? null) : null,
    dropoffZoneName,
    deliveryNotes: isPostMatched ? (rawContacts?.delivery_notes ?? null) : null,
    recipientName: isPostMatched ? (rawContacts?.recipient_name ?? null) : null,
    recipientPhone: isPostMatched ? (rawContacts?.recipient_phone ?? null) : null,
    recipientPaymentMethod: row.recipient_payment_method,
    needsChange: row.needs_change,
    cashChangeAmount: row.cash_change_amount,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
    createdAt: row.created_at,
    matchedAt: row.matched_at,
    pickedUpAt: row.picked_up_at,
    deliveredAt: row.delivered_at,
  };
}
