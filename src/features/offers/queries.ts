import 'server-only';

import { createClient } from '@/server/supabase/server';
import type {
  AvailableRequestItem,
  CourierOfferItem,
  CourierStatusInfo,
} from './schemas';

function formatApproxDistanceKm(distanceM: number | null): string {
  if (!distanceM || distanceM <= 0) {
    return '1,0';
  }
  const km = distanceM / 1000;
  // Redondeo amigable a 0,5 km
  const rounded = Math.round(km * 2) / 2;
  return rounded.toFixed(1).replace('.', ',');
}

interface RawAvailableRequest {
  id: string;
  approx_distance_m: number | null;
  package_type: string;
  recipient_payment_method: string;
  needs_change: boolean;
  cash_change_amount: number | null;
  notes: string | null;
  published_at: string | null;
  expires_at: string | null;
  pickup_zone: { name: string } | { name: string }[] | null;
  dropoff_zone: { name: string } | { name: string }[] | null;
}

interface RawUserOffer {
  request_id: string;
  amount_ars: number;
}

interface RawOfferWithRequest {
  id: string;
  request_id: string;
  amount_ars: number;
  eta_minutes: number;
  message: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
  delivery_requests:
    | {
        expires_at: string | null;
        approx_distance_m: number | null;
        pickup_zone: { name: string } | { name: string }[] | null;
        dropoff_zone: { name: string } | { name: string }[] | null;
      }
    | {
        expires_at: string | null;
        approx_distance_m: number | null;
        pickup_zone: { name: string } | { name: string }[] | null;
        dropoff_zone: { name: string } | { name: string }[] | null;
      }[]
    | null;
}

/**
 * Consulta de solicitudes abiertas disponibles para repartidores.
 * CUMPLE REGLAS D3 y D15: No solicita ni expone coordenadas (lat/lng) ni datos
 * de contacto del destinatario (nombre, teléfono, dirección exacta).
 */
export async function getAvailableRequests(): Promise<AvailableRequestItem[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: requests, error } = await supabase
    .from('delivery_requests')
    .select(`
      id,
      approx_distance_m,
      package_type,
      recipient_payment_method,
      needs_change,
      cash_change_amount,
      notes,
      published_at,
      expires_at,
      pickup_zone:zones!pickup_zone_id(name),
      dropoff_zone:zones!dropoff_zone_id(name)
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const rawRequests = requests as unknown as RawAvailableRequest[] | null;
  if (error || !rawRequests) {
    return [];
  }

  // Verificar si el repartidor autenticado ya tiene ofertas activas en estas solicitudes
  const requestIds = rawRequests.map((r) => r.id);
  const myOffersMap = new Map<string, number>();

  if (user && requestIds.length > 0) {
    const { data: userOffers } = await supabase
      .from('offers')
      .select('request_id, amount_ars')
      .eq('courier_id', user.id)
      .in('request_id', requestIds)
      .eq('status', 'pending');

    const rawUserOffers = userOffers as unknown as RawUserOffer[] | null;
    if (rawUserOffers) {
      for (const off of rawUserOffers) {
        myOffersMap.set(off.request_id, off.amount_ars);
      }
    }
  }

  return rawRequests.map((req) => {
    const pickupZone = Array.isArray(req.pickup_zone)
      ? req.pickup_zone[0]
      : req.pickup_zone;
    const dropoffZone = Array.isArray(req.dropoff_zone)
      ? req.dropoff_zone[0]
      : req.dropoff_zone;

    const myOfferAmount = myOffersMap.get(req.id) ?? null;

    return {
      id: req.id,
      pickupZoneName: pickupZone?.name ?? 'Centro',
      dropoffZoneName: dropoffZone?.name ?? 'Aguilares',
      approxDistanceKm: formatApproxDistanceKm(req.approx_distance_m),
      packageType: (req.package_type as 'small' | 'medium' | 'large') ?? 'small',
      recipientPaymentMethod:
        (req.recipient_payment_method as 'cash' | 'transfer') ?? 'cash',
      needsChange: Boolean(req.needs_change),
      cashChangeAmount: req.cash_change_amount,
      notes: req.notes,
      publishedAt: req.published_at ?? new Date().toISOString(),
      expiresAt: req.expires_at,
      hasMyOffer: myOfferAmount !== null,
      myOfferAmountArs: myOfferAmount,
    };
  });
}

/**
 * Obtiene el estado y disponibilidad del repartidor en sesión.
 */
export async function getCourierStatusAndAvailability(): Promise<CourierStatusInfo> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: 'pending',
      available: false,
    };
  }

  const { data: courier, error } = await supabase
    .from('couriers')
    .select('status, available')
    .eq('profile_id', user.id)
    .maybeSingle<{ status: string; available: boolean }>();

  if (error || !courier) {
    return {
      status: 'pending',
      available: false,
    };
  }

  return {
    status: (courier.status as CourierStatusInfo['status']) ?? 'pending',
    available: Boolean(courier.available),
  };
}

/**
 * Obtiene el piso de oferta dinámico vigente en ARS desde platform_settings.
 */
export async function getPlatformMinOfferArs(): Promise<number> {
  const supabase = await createClient();

  const { data: setting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'min_offer_ars')
    .maybeSingle<{ value: unknown }>();

  if (setting && typeof setting.value === 'number') {
    return setting.value;
  }
  if (setting && typeof setting.value === 'string') {
    const parsed = parseInt(setting.value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1000;
}

/**
 * Consulta de ofertas enviadas por el repartidor autenticado (R06).
 */
export async function getMyOffers(): Promise<CourierOfferItem[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data: offers, error } = await supabase
    .from('offers')
    .select(`
      id,
      request_id,
      amount_ars,
      eta_minutes,
      message,
      status,
      created_at,
      decided_at,
      delivery_requests (
        expires_at,
        approx_distance_m,
        pickup_zone:zones!pickup_zone_id(name),
        dropoff_zone:zones!dropoff_zone_id(name)
      )
    `)
    .eq('courier_id', user.id)
    .order('created_at', { ascending: false });

  const rawOffers = offers as unknown as RawOfferWithRequest[] | null;
  if (error || !rawOffers) {
    return [];
  }

  return rawOffers.map((off) => {
    const req = Array.isArray(off.delivery_requests)
      ? off.delivery_requests[0]
      : off.delivery_requests;

    const pickupZone = req?.pickup_zone
      ? Array.isArray(req.pickup_zone)
        ? req.pickup_zone[0]
        : req.pickup_zone
      : null;

    const dropoffZone = req?.dropoff_zone
      ? Array.isArray(req.dropoff_zone)
        ? req.dropoff_zone[0]
        : req.dropoff_zone
      : null;

    return {
      offerId: off.id,
      requestId: off.request_id,
      pickupZoneName: pickupZone?.name ?? 'Centro',
      dropoffZoneName: dropoffZone?.name ?? 'Aguilares',
      amountArs: off.amount_ars,
      etaMinutes: off.eta_minutes,
      message: off.message,
      status: off.status as CourierOfferItem['status'],
      createdAt: off.created_at,
      decidedAt: off.decided_at,
      requestExpiresAt: req?.expires_at ?? null,
      approxDistanceKm: formatApproxDistanceKm(req?.approx_distance_m ?? null),
    };
  });
}
