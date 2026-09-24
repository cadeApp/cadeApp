import 'server-only';

import { createClient } from '@/server/supabase/server';
import type {
  MerchantRequestSummary,
  MerchantRequestDetail,
  MerchantOfferItem,
  MerchantMetrics,
} from './types';
import type { PackageType, RecipientPaymentMethod, DeliveryRequestStatus } from '@/domain/schemas';

export interface ZoneOption {
  readonly id: string;
  readonly name: string;
  readonly centroidLat: number | null;
  readonly centroidLng: number | null;
}

export interface MerchantDefaultPickup {
  readonly defaultPickupAddress: string | null;
  readonly defaultPickupZoneId: string | null;
  readonly defaultPickupLat: number | null;
  readonly defaultPickupLng: number | null;
  readonly notes: string | null;
}

interface ZoneRow {
  id: string;
  name: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
}

function formatApproxDistanceKm(distanceM: number | null): string {
  if (!distanceM || distanceM <= 0) {
    return '1,0';
  }
  const km = distanceM / 1000;
  const rounded = Math.round(km * 2) / 2;
  return rounded.toFixed(1).replace('.', ',');
}

export async function getActiveZones(): Promise<ZoneOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('zones')
    .select<string, ZoneRow>('id, name, centroid_lat, centroid_lng')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((z) => ({
    id: z.id,
    name: z.name,
    centroidLat: z.centroid_lat,
    centroidLng: z.centroid_lng,
  }));
}

export async function getMerchantDefaultPickup(
  merchantProfileId: string
): Promise<MerchantDefaultPickup | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('merchants')
    .select(
      'default_pickup_address, default_pickup_zone_id, default_pickup_lat, default_pickup_lng, notes'
    )
    .eq('profile_id', merchantProfileId)
    .maybeSingle<{
      default_pickup_address: string | null;
      default_pickup_zone_id: string | null;
      default_pickup_lat: number | null;
      default_pickup_lng: number | null;
      notes: string | null;
    }>();

  if (error || !data) {
    return null;
  }

  return {
    defaultPickupAddress: data.default_pickup_address,
    defaultPickupZoneId: data.default_pickup_zone_id,
    defaultPickupLat: data.default_pickup_lat,
    defaultPickupLng: data.default_pickup_lng,
    notes: data.notes,
  };
}

interface RawMerchantRequest {
  id: string;
  approx_distance_m: number | null;
  package_type: string;
  recipient_payment_method: string;
  needs_change: boolean;
  cash_change_amount: number | null;
  status: string;
  expires_at: string | null;
  created_at: string;
  accepted_offer_id: string | null;
  pickup_zone: { name: string } | { name: string }[] | null;
  dropoff_zone: { name: string } | { name: string }[] | null;
}

interface RawOfferItem {
  id: string;
  courier_id: string;
  amount_ars: number;
  eta_minutes: number;
  message: string | null;
  status: string;
  created_at: string;
  courier?: {
    vehicle_type: string | null;
    license_status: string;
    insurance_status: string;
    doc_level: number;
    profile?: {
      display_name: string;
    } | null;
  } | null;
}

export async function getMerchantRequests(merchantId: string): Promise<{
  requests: MerchantRequestSummary[];
  metrics: MerchantMetrics;
}> {
  const supabase = await createClient();

  const { data: requestsData, error } = await supabase
    .from('delivery_requests')
    .select(`
      id,
      approx_distance_m,
      package_type,
      recipient_payment_method,
      needs_change,
      cash_change_amount,
      status,
      expires_at,
      created_at,
      accepted_offer_id,
      pickup_zone:zones!pickup_zone_id(name),
      dropoff_zone:zones!dropoff_zone_id(name)
    `)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  const rawRequests = (requestsData as unknown as RawMerchantRequest[] | null) ?? [];

  if (error || !rawRequests.length) {
    return {
      requests: [],
      metrics: {
        dispatchedToday: 0,
        avgRateArs: 0,
        activeCount: 0,
      },
    };
  }

  // Contar ofertas pendientes para cada solicitud
  const requestIds = rawRequests.map((r) => r.id);
  const offersCountMap = new Map<string, number>();

  const { data: offersData } = await supabase
    .from('offers')
    .select('request_id')
    .in('request_id', requestIds)
    .eq('status', 'pending');

  if (offersData) {
    for (const off of offersData as Array<{ request_id: string }>) {
      offersCountMap.set(off.request_id, (offersCountMap.get(off.request_id) ?? 0) + 1);
    }
  }

  // Calcular métricas
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let dispatchedToday = 0;
  let activeCount = 0;

  const requests: MerchantRequestSummary[] = rawRequests.map((req) => {
    const pickupZone = Array.isArray(req.pickup_zone) ? req.pickup_zone[0] : req.pickup_zone;
    const dropoffZone = Array.isArray(req.dropoff_zone) ? req.dropoff_zone[0] : req.dropoff_zone;

    if (['published', 'matched', 'in_transit'].includes(req.status)) {
      activeCount += 1;
    }

    if (
      ['matched', 'in_transit', 'delivered'].includes(req.status) &&
      req.created_at >= todayStart
    ) {
      dispatchedToday += 1;
    }

    return {
      id: req.id,
      pickupZoneName: pickupZone?.name ?? 'Centro',
      dropoffZoneName: dropoffZone?.name ?? 'Aguilares',
      approxDistanceKm: formatApproxDistanceKm(req.approx_distance_m),
      packageType: req.package_type as PackageType,
      recipientPaymentMethod: req.recipient_payment_method as RecipientPaymentMethod,
      needsChange: Boolean(req.needs_change),
      cashChangeAmount: req.cash_change_amount,
      status: req.status as DeliveryRequestStatus,
      expiresAt: req.expires_at,
      createdAt: req.created_at,
      offersCount: offersCountMap.get(req.id) ?? 0,
      acceptedOfferId: req.accepted_offer_id,
    };
  });

  return {
    requests,
    metrics: {
      dispatchedToday,
      avgRateArs: 1800, // Tarifa promedio de referencia en Aguilares
      activeCount,
    },
  };
}

export async function getMerchantRequestWithOffers(
  requestId: string,
  merchantId: string
): Promise<{
  request: MerchantRequestDetail;
  offers: MerchantOfferItem[];
} | null> {
  const supabase = await createClient();

  const { data: requestData, error: requestError } = await supabase
    .from('delivery_requests')
    .select(`
      id,
      approx_distance_m,
      package_type,
      recipient_payment_method,
      needs_change,
      cash_change_amount,
      notes,
      status,
      expires_at,
      created_at,
      accepted_offer_id,
      pickup_zone:zones!pickup_zone_id(name),
      dropoff_zone:zones!dropoff_zone_id(name)
    `)
    .eq('id', requestId)
    .eq('merchant_id', merchantId)
    .maybeSingle<RawMerchantRequest & { notes: string | null }>();

  if (requestError || !requestData) {
    return null;
  }

  const pickupZone = Array.isArray(requestData.pickup_zone)
    ? requestData.pickup_zone[0]
    : requestData.pickup_zone;
  const dropoffZone = Array.isArray(requestData.dropoff_zone)
    ? requestData.dropoff_zone[0]
    : requestData.dropoff_zone;

  const request: MerchantRequestDetail = {
    id: requestData.id,
    pickupZoneName: pickupZone?.name ?? 'Centro',
    dropoffZoneName: dropoffZone?.name ?? 'Aguilares',
    approxDistanceKm: formatApproxDistanceKm(requestData.approx_distance_m),
    packageType: requestData.package_type as PackageType,
    recipientPaymentMethod: requestData.recipient_payment_method as RecipientPaymentMethod,
    needsChange: Boolean(requestData.needs_change),
    cashChangeAmount: requestData.cash_change_amount,
    notes: requestData.notes,
    status: requestData.status as DeliveryRequestStatus,
    expiresAt: requestData.expires_at,
    createdAt: requestData.created_at,
    acceptedOfferId: requestData.accepted_offer_id,
  };

  // Obtener ofertas de la solicitud
  const { data: offersData } = await supabase
    .from('offers')
    .select(`
      id,
      courier_id,
      amount_ars,
      eta_minutes,
      message,
      status,
      created_at,
      courier:couriers!courier_id(
        vehicle_type,
        license_status,
        insurance_status,
        doc_level,
        profile:profiles!profile_id(display_name)
      )
    `)
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });

  const rawOffers = (offersData as unknown as RawOfferItem[] | null) ?? [];

  const offers: MerchantOfferItem[] = rawOffers.map((o) => {
    const courierObj = Array.isArray(o.courier) ? o.courier[0] : o.courier;
    const profileObj = courierObj?.profile
      ? Array.isArray(courierObj.profile)
        ? courierObj.profile[0]
        : courierObj.profile
      : null;

    const displayName = profileObj?.display_name || 'Repartidor';

    return {
      id: o.id,
      courierId: o.courier_id,
      courierName: displayName,
      vehicleType: courierObj?.vehicle_type ?? 'motorcycle',
      amountArs: o.amount_ars,
      etaMinutes: o.eta_minutes,
      message: o.message,
      licenseStatus: (courierObj?.license_status as MerchantOfferItem['licenseStatus']) ?? 'none',
      insuranceStatus:
        (courierObj?.insurance_status as MerchantOfferItem['insuranceStatus']) ?? 'none',
      docLevel: ((courierObj?.doc_level as number) ?? 0) as 0 | 1 | 2,
      createdAt: o.created_at,
      status: o.status as MerchantOfferItem['status'],
    };
  });

  return { request, offers };
}
