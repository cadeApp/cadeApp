import 'server-only';

import { createClient } from '@/server/supabase/server';
import { getTripDetailsServer } from '@/server/rpc/trips';
import { getRequestCancellationHistoryServer } from '@/server/rpc/request-cancellation-history';
import type { DeliveryRequestStatus, RequestCancellationHistory, RpcErrorCode, ActionResult } from '@/domain';
import type { TripDetails } from './types';

/**
 * T-373 / PR425-H02: el detalle del viaje no se pudo leer por una falla (no por ausencia ni falta de permiso). Se
 * lanza para que llegue al `error.tsx` de la ruta y nunca se confunda con «Cancelaste esta asignación». El mensaje es
 * fijo: no lleva ids ni datos de la RPC.
 */
export class TripDetailsUnavailableError extends Error {
  constructor() {
    super('TRIP_DETAILS_UNAVAILABLE');
    this.name = 'TripDetailsUnavailableError';
  }
}

/**
 * Adaptador T-115 / T-117 sobre la frontera autoritativa de CC-008.
 * La autorización, revelación post-matched y procedencia del monto viven en
 * public.get_trip_details + getTripDetailsServer.
 * Las coordenadas y distancia calculada se proyectan post-matched vía RLS
 * sobre delivery_request_contacts y delivery_requests.
 */
export async function getTripDetails(requestId: string): Promise<TripDetails | null> {
  const result = await getTripDetailsServer({ requestId });
  if (!result.ok) {
    // Ausencia esperada (pedido inexistente, ajeno, en otro estado o id inválido): null. Una falla, no.
    if (result.code === 'INTERNAL_ERROR') throw new TripDetailsUnavailableError();
    return null;
  }

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

  const drops = trip.drops ?? [];
  const firstDrop = drops[0];
  const dropoffLat =
    contacts != null
      ? (firstDrop?.dropoffLat != null
        ? Number(firstDrop.dropoffLat)
        : contacts.dropoff_lat != null
        ? Number(contacts.dropoff_lat)
        : null)
      : null;
  const dropoffLng =
    contacts != null
      ? (firstDrop?.dropoffLng != null
        ? Number(firstDrop.dropoffLng)
        : contacts.dropoff_lng != null
        ? Number(contacts.dropoff_lng)
        : null)
      : null;

  const totalAmountArs = trip.amountArs * (drops.length || 1);
  const collectibleAmountArs =
    trip.amountArs * drops.filter((d) => d.status === 'delivered').length;
  const allDropsFailed = drops.length > 0 && drops.every((d) => d.status === 'failed');

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
    totalAmountArs,
    collectibleAmountArs,
    allDropsFailed,
    pickupAddress: trip.pickupAddress,
    pickupZoneName: trip.pickupZoneName,
    pickupLat: contacts?.pickup_lat != null ? Number(contacts.pickup_lat) : null,
    pickupLng: contacts?.pickup_lng != null ? Number(contacts.pickup_lng) : null,
    dropoffAddress: trip.dropoffAddress,
    dropoffZoneName: trip.dropoffZoneName,
    dropoffLat,
    dropoffLng,
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
    dropsCount: trip.dropsCount ?? drops.length,
    drops,
  };
}

export interface ActiveTripSummary {
  readonly id: string;
  readonly status: 'matched' | 'in_transit';
  readonly pickupZoneName: string;
  readonly dropoffZoneName: string | null;
  readonly dropsCount: number;
  readonly amountArs: number;
  readonly matchedAt: string | null;
}

interface RawActiveRequest {
  id: string;
  status: string;
  accepted_offer_id: string | null;
  drops_count: number | null;
  matched_at: string | null;
  pickup_zone: { name: string } | { name: string }[] | null;
  dropoff_zone: { name: string } | { name: string }[] | null;
}

interface RawActiveOffer {
  id: string;
  request_id: string;
  amount_ars: number;
}

/**
 * Consulta autorizada de viajes activos para el repartidor autenticado.
 * Invariante D3/D15: No proyecta direcciones exactas, contactos de destinatario,
 * teléfonos de comercio ni coordenadas en el feed de viajes activos.
 */
export async function getActiveTripsForCourier(): Promise<{
  courierId: string;
  trips: ActiveTripSummary[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('No autenticado al consultar viajes activos');
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from('delivery_requests')
    .select(`
      id,
      status,
      accepted_offer_id,
      drops_count,
      matched_at,
      pickup_zone:zones!pickup_zone_id(name),
      dropoff_zone:zones!dropoff_zone_id(name)
    `)
    .in('status', ['matched', 'in_transit']);

  if (requestsError) {
    throw new Error('Error al consultar solicitudes activas');
  }

  const requests = (requestsData as unknown as RawActiveRequest[] | null) ?? [];
  if (requests.length === 0) {
    return { courierId: user.id, trips: [] };
  }

  const acceptedOfferIds = requests
    .map((r) => r.accepted_offer_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (acceptedOfferIds.length === 0) {
    return { courierId: user.id, trips: [] };
  }

  const { data: offersData, error: offersError } = await supabase
    .from('offers')
    .select('id, request_id, amount_ars')
    .in('id', acceptedOfferIds)
    .eq('courier_id', user.id)
    .eq('status', 'accepted');

  if (offersError) {
    throw new Error('Error al consultar ofertas activas');
  }

  const offers = (offersData as unknown as RawActiveOffer[] | null) ?? [];
  if (offers.length === 0) {
    return { courierId: user.id, trips: [] };
  }

  const offersById = new Map<string, RawActiveOffer>();
  for (const offer of offers) {
    offersById.set(offer.id, offer);
  }

  const candidateTrips: ActiveTripSummary[] = [];

  for (const req of requests) {
    if (!req.accepted_offer_id) continue;
    const matchingOffer = offersById.get(req.accepted_offer_id);
    if (!matchingOffer || matchingOffer.request_id !== req.id) {
      continue;
    }
    if (req.status !== 'matched' && req.status !== 'in_transit') {
      continue;
    }

    const pickupZone = Array.isArray(req.pickup_zone) ? req.pickup_zone[0] : req.pickup_zone;
    const dropoffZone = Array.isArray(req.dropoff_zone) ? req.dropoff_zone[0] : req.dropoff_zone;

    const dropsCount = req.drops_count != null && req.drops_count > 0 ? req.drops_count : 1;
    const dropoffZoneName = dropsCount > 1 ? null : (dropoffZone?.name ?? null);

    candidateTrips.push({
      id: req.id,
      status: req.status,
      pickupZoneName: pickupZone?.name ?? 'Aguilares',
      dropoffZoneName,
      dropsCount,
      amountArs: matchingOffer.amount_ars,
      matchedAt: req.matched_at,
    });
  }

  const needsDropsLookup = candidateTrips.filter(
    (t) => t.dropsCount <= 1 && !t.dropoffZoneName
  );
  if (needsDropsLookup.length > 0) {
    const { data: dropsData, error: dropsError } = await supabase
      .from('delivery_request_drops')
      .select('request_id, position, dropoff_zone:zones!dropoff_zone_id(name)')
      .in('request_id', needsDropsLookup.map((t) => t.id))
      .eq('position', 1);

    if (dropsError) {
      throw new Error('Error al consultar zonas de entregas activas');
    }

    if (dropsData && Array.isArray(dropsData)) {
      interface RawDropZone {
        request_id: string;
        dropoff_zone: { name: string } | { name: string }[] | null;
      }
      const dropZoneMap = new Map<string, string>();
      for (const d of dropsData as unknown as RawDropZone[]) {
        const zone = Array.isArray(d.dropoff_zone) ? d.dropoff_zone[0] : d.dropoff_zone;
        if (zone?.name) {
          dropZoneMap.set(d.request_id, zone.name);
        }
      }
      for (const trip of candidateTrips) {
        if (trip.dropsCount <= 1 && !trip.dropoffZoneName) {
          const zoneName = dropZoneMap.get(trip.id);
          if (zoneName) {
            (trip as { dropoffZoneName: string | null }).dropoffZoneName = zoneName;
          }
        }
      }
    }
  }

  // Orden estable por matchedAt descendente y por id como desempate, deduplicado por id
  candidateTrips.sort((a, b) => {
    const timeA = a.matchedAt ? new Date(a.matchedAt).getTime() : 0;
    const timeB = b.matchedAt ? new Date(b.matchedAt).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.id.localeCompare(a.id);
  });

  const uniqueTrips: ActiveTripSummary[] = [];
  const seenIds = new Set<string>();
  for (const trip of candidateTrips) {
    if (!seenIds.has(trip.id)) {
      seenIds.add(trip.id);
      uniqueTrips.push(trip);
    }
  }

  return {
    courierId: user.id,
    trips: uniqueTrips,
  };
}

/** T-373: estados del pedido en los que `/merchant/requests/[id]` muestra el historial (los demás no lo renderizan). */
export const STATUSES_WITH_CANCELLATION_HISTORY: readonly DeliveryRequestStatus[] = ['published', 'cancelled', 'expired'];

type CancellationHistoryLoad = (input: {
  requestId: string;
}) => Promise<ActionResult<RequestCancellationHistory, RpcErrorCode<'get_request_cancellation_history'>>>;

/**
 * T-373 / PR425-H03: lee el historial solo si la rama del detalle lo va a mostrar. `draft` no lo usa, y
 * `matched`/`in_transit`/`delivered` redirigen a `/trips/[id]`, que lo lee de nuevo. En esos casos no se llama a la RPC.
 */
export async function loadCancellationHistoryForRequestDetail(
  requestId: string,
  status: DeliveryRequestStatus,
  load: CancellationHistoryLoad = getRequestCancellationHistoryServer
) {
  if (!STATUSES_WITH_CANCELLATION_HISTORY.includes(status)) return null;
  return load({ requestId });
}
