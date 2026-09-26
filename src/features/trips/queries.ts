import { createClient } from '@/server/supabase/server';
import type { TripDetails } from './types';
import type { DeliveryRequestStatus, RecipientPaymentMethod } from '@/domain';

interface RawOfferItem {
  id: string;
  courier_id: string;
  amount_ars: number;
  status: string;
}

interface RawContactItem {
  pickup_address?: string | null;
  dropoff_address?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
}

interface RawDeliveryRequestDbRow {
  id: string;
  merchant_id: string;
  status: DeliveryRequestStatus;
  pickup_zone_id: string;
  dropoff_zone_id: string;
  pickup_zone?: { name?: string | null } | Array<{ name?: string | null }> | null;
  dropoff_zone?: { name?: string | null } | Array<{ name?: string | null }> | null;
  package_type: string;
  recipient_payment_method: RecipientPaymentMethod;
  needs_change: boolean;
  cash_change_amount: number | null;
  notes: string | null;
  accepted_offer_id: string | null;
  created_at: string;
  matched_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  contacts?: RawContactItem | RawContactItem[] | null;
  offers?: RawOfferItem[] | null;
}

/**
 * Consulta del viaje activo con revelación progresiva y procedencia estricta de oferta aceptada (H09, H13, H15, H21).
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
      merchant_id,
      status,
      pickup_zone_id,
      dropoff_zone_id,
      pickup_zone:pickup_zone_id(name),
      dropoff_zone:dropoff_zone_id(name),
      package_type,
      recipient_payment_method,
      needs_change,
      cash_change_amount,
      notes,
      accepted_offer_id,
      created_at,
      matched_at,
      picked_up_at,
      delivered_at,
      contacts:delivery_request_contacts(
        pickup_address,
        dropoff_address,
        recipient_name,
        recipient_phone
      ),
      offers(
        id,
        courier_id,
        amount_ars,
        status
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
  const isPostMatched = ['matched', 'in_transit', 'delivered'].includes(row.status);

  // H21: En estado post-matched debe existir una oferta aceptada con monto positivo
  if (isPostMatched && (!acceptedOffer || typeof acceptedOffer.amount_ars !== 'number' || acceptedOffer.amount_ars <= 0)) {
    return null;
  }

  const rawContacts: RawContactItem | undefined = Array.isArray(row.contacts)
    ? row.contacts[0]
    : (row.contacts ?? undefined);

  const pickupZoneName = Array.isArray(row.pickup_zone)
    ? (row.pickup_zone[0]?.name ?? '')
    : (row.pickup_zone?.name ?? '');

  const dropoffZoneName = Array.isArray(row.dropoff_zone)
    ? (row.dropoff_zone[0]?.name ?? '')
    : (row.dropoff_zone?.name ?? '');

  // D04: El código visual se deriva del UUID
  const code = `REQ-${row.id.slice(0, 8).toUpperCase()}`;

  return {
    id: row.id,
    code,
    status: row.status,
    merchantId: row.merchant_id,
    courierId: assignedCourierId,
    courierName: null, // Asignado vía D03 / CC-008
    vehicleType: null, // Asignado vía D03 / CC-008
    licensePlate: null, // Asignado vía D03 / CC-008
    avatarUrl: null, // Asignado vía D03 / CC-008
    amountArs: acceptedOffer ? acceptedOffer.amount_ars : null,
    pickupAddress: rawContacts?.pickup_address ?? '',
    pickupZoneName,
    dropoffAddress: isPostMatched ? (rawContacts?.dropoff_address ?? null) : null,
    dropoffZoneName,
    deliveryNotes: isPostMatched ? (row.notes ?? null) : null,
    recipientName: isPostMatched ? (rawContacts?.recipient_name ?? null) : null,
    recipientPhone: isPostMatched ? (rawContacts?.recipient_phone ?? null) : null,
    recipientPaymentMethod: row.recipient_payment_method,
    needsChange: row.needs_change,
    cashChangeAmount: row.cash_change_amount,
    createdAt: row.created_at,
    matchedAt: row.matched_at,
    pickedUpAt: row.picked_up_at,
    deliveredAt: row.delivered_at,
  };
}
