import 'server-only';

import { z } from 'zod';
import { createClient } from '@/server/supabase/server';
import type {
  MerchantRequestSummary,
  MerchantRequestDetail,
  MerchantOfferItem,
  MerchantMetrics,
} from './types';
import type { PackageType, RecipientPaymentMethod, DeliveryRequestStatus } from '@/domain/schemas';

export const historyFilterStatusSchema = z.enum(['all', 'delivered', 'cancelled', 'expired']);
export type HistoryFilterStatus = z.infer<typeof historyFilterStatusSchema>;

export const merchantHistoryCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

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

export interface MerchantHistoryCursor {
  readonly createdAt: string;
  readonly id: string;
}

export interface GetMerchantRequestsOptions {
  readonly limit?: number;
  readonly status?: HistoryFilterStatus;
  readonly cursor?: MerchantHistoryCursor | null;
}

export function parseMerchantHistorySearchParams(raw?: {
  status?: string;
  cursorCreatedAt?: string;
  cursorId?: string;
}): {
  status: HistoryFilterStatus;
  cursor: MerchantHistoryCursor | null;
} {
  const statusParsed = historyFilterStatusSchema.safeParse(raw?.status);
  const status: HistoryFilterStatus = statusParsed.success ? statusParsed.data : 'all';

  if (!raw?.cursorCreatedAt || !raw?.cursorId) {
    return { status, cursor: null };
  }

  const cursorParsed = merchantHistoryCursorSchema.safeParse({
    createdAt: raw.cursorCreatedAt,
    id: raw.cursorId,
  });

  return {
    status,
    cursor: cursorParsed.success ? cursorParsed.data : null,
  };
}

interface ZoneRow {
  id: string;
  name: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
}

export function formatApproxDistanceKm(distanceM: number | null): string | null {
  if (!distanceM || distanceM <= 0) {
    return null;
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

  if (error) {
    throw new Error(`Error al cargar zonas activas: ${error.message}`);
  }

  if (!data) {
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

  if (error) {
    throw new Error(`Error al cargar dirección de retiro del comercio: ${error.message}`);
  }

  if (!data) {
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

function mapRawMerchantRequests(
  rawRequests: RawMerchantRequest[],
  offersCountMap: Map<string, number>
): MerchantRequestSummary[] {
  return rawRequests.map((req) => {
    const pickupZone = Array.isArray(req.pickup_zone) ? req.pickup_zone[0] : req.pickup_zone;
    const dropoffZone = Array.isArray(req.dropoff_zone) ? req.dropoff_zone[0] : req.dropoff_zone;

    return {
      id: req.id,
      pickupZoneName: pickupZone?.name ?? 'Zona no disponible',
      dropoffZoneName: dropoffZone?.name ?? 'Zona no disponible',
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
}

export async function getMerchantHistoryRequests(
  merchantId: string,
  options?: GetMerchantRequestsOptions
): Promise<{
  requests: MerchantRequestSummary[];
  nextCursor: MerchantHistoryCursor | null;
  status: HistoryFilterStatus;
}> {
  const supabase = await createClient();
  const pageSize = Math.min(Math.max(1, options?.limit ?? 50), 50);
  const statusParsed = historyFilterStatusSchema.safeParse(options?.status);
  const status: HistoryFilterStatus = statusParsed.success ? statusParsed.data : 'all';

  const cursorParsed = options?.cursor
    ? merchantHistoryCursorSchema.safeParse(options.cursor)
    : null;
  const validCursor: MerchantHistoryCursor | null =
    cursorParsed && cursorParsed.success ? cursorParsed.data : null;

  let query = supabase
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
    .eq('merchant_id', merchantId);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  query = query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (validCursor) {
    query = query.or(
      `created_at.lt.${validCursor.createdAt},and(created_at.eq.${validCursor.createdAt},id.lt.${validCursor.id})`
    );
  }

  const { data: requestsData, error } = await query;

  if (error) {
    throw new Error(`Error al cargar historial de solicitudes: ${error.message}`);
  }

  const fetchedRows = (requestsData as unknown as RawMerchantRequest[] | null) ?? [];
  const hasMore = fetchedRows.length > pageSize;
  const rawRequests = hasMore ? fetchedRows.slice(0, pageSize) : fetchedRows;
  const lastItem = rawRequests.at(-1);
  const nextCursor: MerchantHistoryCursor | null =
    hasMore && lastItem ? { createdAt: lastItem.created_at, id: lastItem.id } : null;

  if (!rawRequests.length) {
    return {
      requests: [],
      nextCursor: null,
      status,
    };
  }

  const requestIds = rawRequests.map((r) => r.id);
  const offersCountMap = new Map<string, number>();

  const { data: offersData, error: offersError } = await supabase
    .from('offers')
    .select('request_id')
    .in('request_id', requestIds)
    .eq('status', 'pending');

  if (offersError) {
    throw new Error(`Error al cargar conteo de ofertas: ${offersError.message}`);
  }

  if (offersData) {
    for (const off of offersData as Array<{ request_id: string }>) {
      offersCountMap.set(off.request_id, (offersCountMap.get(off.request_id) ?? 0) + 1);
    }
  }

  return {
    requests: mapRawMerchantRequests(rawRequests, offersCountMap),
    nextCursor,
    status,
  };
}

export async function getMerchantRequests(
  merchantId: string,
  options?: GetMerchantRequestsOptions
): Promise<{
  requests: MerchantRequestSummary[];
  metrics: MerchantMetrics;
  nextCursor: MerchantHistoryCursor | null;
}> {
  const supabase = await createClient();
  const pageSize = Math.min(Math.max(1, options?.limit ?? 50), 50);
  const statusParsed = historyFilterStatusSchema.safeParse(options?.status);
  const status: HistoryFilterStatus = statusParsed.success ? statusParsed.data : 'all';

  const cursorParsed = options?.cursor
    ? merchantHistoryCursorSchema.safeParse(options.cursor)
    : null;
  const validCursor: MerchantHistoryCursor | null =
    cursorParsed && cursorParsed.success ? cursorParsed.data : null;

  let pageQuery = supabase
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
    .eq('merchant_id', merchantId);

  if (status !== 'all') {
    pageQuery = pageQuery.eq('status', status);
  }

  pageQuery = pageQuery
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (validCursor) {
    pageQuery = pageQuery.or(
      `created_at.lt.${validCursor.createdAt},and(created_at.eq.${validCursor.createdAt},id.lt.${validCursor.id})`
    );
  }

  const metricsQuery = supabase
    .from('delivery_requests')
    .select('id, status, created_at, accepted_offer_id')
    .eq('merchant_id', merchantId);

  const [pageResult, metricsResult] = await Promise.all([pageQuery, metricsQuery]);

  if (pageResult.error) {
    throw new Error(`Error al cargar solicitudes del comercio: ${pageResult.error.message}`);
  }
  if (metricsResult.error) {
    throw new Error(`Error al cargar métricas del comercio: ${metricsResult.error.message}`);
  }

  const fetchedRows = (pageResult.data as unknown as RawMerchantRequest[] | null) ?? [];
  const hasMore = fetchedRows.length > pageSize;
  const rawRequests = hasMore ? fetchedRows.slice(0, pageSize) : fetchedRows;
  const lastItem = rawRequests.at(-1);
  const nextCursor: MerchantHistoryCursor | null =
    hasMore && lastItem ? { createdAt: lastItem.created_at, id: lastItem.id } : null;

  const allMerchantRows =
    (metricsResult.data as unknown as Array<{
      id: string;
      status: string;
      created_at: string;
      accepted_offer_id: string | null;
    }> | null) ?? rawRequests;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let dispatchedToday = 0;
  let activeCount = 0;
  const acceptedOfferIds: string[] = [];

  for (const row of allMerchantRows) {
    if (['published', 'matched', 'in_transit'].includes(row.status)) {
      activeCount += 1;
    }
    if (
      ['matched', 'in_transit', 'delivered'].includes(row.status) &&
      row.created_at >= todayStart
    ) {
      dispatchedToday += 1;
    }
    if (row.accepted_offer_id) {
      acceptedOfferIds.push(row.accepted_offer_id);
    }
  }

  let avgRateArs: number | null = null;
  if (acceptedOfferIds.length > 0) {
    const { data: acceptedOffersData, error: acceptedOffersError } = await supabase
      .from('offers')
      .select('amount_ars')
      .in('id', acceptedOfferIds);

    if (acceptedOffersError) {
      throw new Error(`Error al cargar ofertas aceptadas: ${acceptedOffersError.message}`);
    }

    const validAmounts = (
      (acceptedOffersData as Array<{ amount_ars: number }> | null) ?? []
    ).filter((o) => typeof o.amount_ars === 'number' && o.amount_ars > 0);

    if (validAmounts.length > 0) {
      const sum = validAmounts.reduce((acc, item) => acc + item.amount_ars, 0);
      avgRateArs = Math.round(sum / validAmounts.length);
    }
  }

  if (!rawRequests.length) {
    return {
      requests: [],
      metrics: {
        dispatchedToday,
        avgRateArs,
        activeCount,
      },
      nextCursor: null,
    };
  }

  const requestIds = rawRequests.map((r) => r.id);
  const offersCountMap = new Map<string, number>();

  const { data: offersData, error: offersError } = await supabase
    .from('offers')
    .select('request_id')
    .in('request_id', requestIds)
    .eq('status', 'pending');

  if (offersError) {
    throw new Error(`Error al cargar ofertas pendientes: ${offersError.message}`);
  }

  if (offersData) {
    for (const off of offersData as Array<{ request_id: string }>) {
      offersCountMap.set(off.request_id, (offersCountMap.get(off.request_id) ?? 0) + 1);
    }
  }

  return {
    requests: mapRawMerchantRequests(rawRequests, offersCountMap),
    metrics: {
      dispatchedToday,
      avgRateArs,
      activeCount,
    },
    nextCursor,
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

  if (requestError) {
    throw new Error(`Error al cargar detalle de solicitud: ${requestError.message}`);
  }

  if (!requestData) {
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
    pickupZoneName: pickupZone?.name ?? 'Zona no disponible',
    dropoffZoneName: dropoffZone?.name ?? 'Zona no disponible',
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

  const { data: offersData, error: offersError } = await supabase
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

  if (offersError) {
    throw new Error(`Error al cargar ofertas de la solicitud: ${offersError.message}`);
  }

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
      vehicleType: courierObj?.vehicle_type ?? null,
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
