import 'server-only';
import { z } from 'zod';
import { createClient } from '@/server/supabase/server';
import { getTripDetailsRpc } from '@/server/rpc/trips';
import type {
  LiveAvailableRequestItem,
  LiveMerchantOfferItem,
  LiveTripState,
} from '@/lib/live-contracts';

export type LiveServerResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string; readonly status: number };

function formatApproxDistanceKm(distanceM: number | null): string {
  if (!distanceM || distanceM <= 0) {
    return '1,0';
  }
  const km = distanceM / 1000;
  const rounded = Math.round(km * 2) / 2;
  return rounded.toFixed(1).replace('.', ',');
}

interface RawAvailableRequestRow {
  readonly id: string;
  readonly approx_distance_m: number | null;
  readonly package_type: string;
  readonly recipient_payment_method: string;
  readonly needs_change: boolean;
  readonly cash_change_amount: number | null;
  readonly notes: string | null;
  readonly published_at: string | null;
  readonly expires_at: string | null;
  readonly pickup_zone?: { name: string } | Array<{ name: string }> | null;
  readonly dropoff_zone?: { name: string } | Array<{ name: string }> | null;
}

interface RawOfferRow {
  readonly id: string;
  readonly courier_id: string;
  readonly amount_ars: number;
  readonly eta_minutes: number;
  readonly message: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly courier?: {
    readonly vehicle_type?: string | null;
    readonly license_status?: string;
    readonly insurance_status?: string;
    readonly doc_level?: number;
    readonly profile?: { readonly display_name?: string } | Array<{ readonly display_name?: string }> | null;
  } | Array<{
    readonly vehicle_type?: string | null;
    readonly license_status?: string;
    readonly insurance_status?: string;
    readonly doc_level?: number;
    readonly profile?: { readonly display_name?: string } | Array<{ readonly display_name?: string }> | null;
  }> | null;
}

/**
 * 3.1 Consulta de solicitudes disponibles para el repartidor autenticado.
 * - Requiere sesión activa de usuario.
 * - Lee delivery_requests en status=published con SOLO columnas públicas de feed.
 * - Consulta ofertas pendientes del courier para computar hasMyOffer y myOfferAmountArs.
 * - Jamás lee contactos, direcciones exactas ni coordenadas.
 */
export async function getAvailableRequestsLiveServer(): Promise<LiveServerResult<LiveAvailableRequestItem[]>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: 'UNAUTHENTICATED', status: 401 };
  }

  const { data: requestsData, error: requestsError } = await supabase
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

  if (requestsError || !requestsData) {
    return { ok: false, error: 'DATABASE_ERROR', status: 500 };
  }

  const rows = requestsData as unknown as readonly RawAvailableRequestRow[];
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const requestIds = rows.map((r) => r.id);
  const myOffersMap = new Map<string, number>();

  const { data: userOffers, error: offersError } = await supabase
    .from('offers')
    .select('request_id, amount_ars')
    .eq('courier_id', user.id)
    .in('request_id', requestIds)
    .eq('status', 'pending');

  if (offersError) {
    return { ok: false, error: 'DATABASE_ERROR', status: 500 };
  }

  if (userOffers) {
    const rawUserOffers = userOffers as unknown as Array<{
      readonly request_id: string;
      readonly amount_ars: number;
    }>;
    for (const off of rawUserOffers) {
      myOffersMap.set(off.request_id, off.amount_ars);
    }
  }

  const mapped: LiveAvailableRequestItem[] = rows.map((req) => {
    const pickupZone = Array.isArray(req.pickup_zone) ? req.pickup_zone[0] : req.pickup_zone;
    const dropoffZone = Array.isArray(req.dropoff_zone) ? req.dropoff_zone[0] : req.dropoff_zone;
    const myOfferAmount = myOffersMap.get(req.id) ?? null;

    return {
      id: req.id,
      pickupZoneName: pickupZone?.name ?? 'Centro',
      dropoffZoneName: dropoffZone?.name ?? 'Aguilares',
      approxDistanceKm: formatApproxDistanceKm(req.approx_distance_m),
      packageType: (req.package_type as LiveAvailableRequestItem['packageType']) ?? 'small',
      recipientPaymentMethod:
        (req.recipient_payment_method as LiveAvailableRequestItem['recipientPaymentMethod']) ?? 'cash',
      needsChange: Boolean(req.needs_change),
      cashChangeAmount: req.cash_change_amount,
      notes: req.notes,
      publishedAt: req.published_at ?? new Date().toISOString(),
      expiresAt: req.expires_at,
      hasMyOffer: myOfferAmount !== null,
      myOfferAmountArs: myOfferAmount,
    };
  });

  return { ok: true, data: mapped };
}

/**
 * 3.2 Consulta de ofertas para una solicitud del comercio.
 * - Valida UUID antes de consultar.
 * - Autentica al usuario.
 * - Verifica propiedad (merchant_id = user.id); si no existe o es ajena, retorna NOT_FOUND.
 * - Si DB falla -> error controlado.
 */
export async function getRequestOffersLiveServer(
  requestId: string
): Promise<LiveServerResult<LiveMerchantOfferItem[]>> {
  const parsedId = z.string().uuid().safeParse(requestId);
  if (!parsedId.success) {
    return { ok: false, error: 'INVALID_REQUEST_ID', status: 400 };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: 'UNAUTHENTICATED', status: 401 };
  }

  // Verificar pertenencia al comercio actual
  const { data: requestRecord, error: requestError } = await supabase
    .from('delivery_requests')
    .select('id, merchant_id')
    .eq('id', parsedId.data)
    .maybeSingle();

  if (requestError) {
    return { ok: false, error: 'DATABASE_ERROR', status: 500 };
  }

  const record = requestRecord as { id: string; merchant_id: string } | null;
  if (!record || record.merchant_id !== user.id) {
    return { ok: false, error: 'NOT_FOUND', status: 404 };
  }

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
    .eq('request_id', parsedId.data)
    .order('created_at', { ascending: false });

  if (offersError) {
    return { ok: false, error: 'DATABASE_ERROR', status: 500 };
  }

  const rawOffers = (offersData as unknown as readonly RawOfferRow[] | null) ?? [];
  const mapped: LiveMerchantOfferItem[] = rawOffers.map((o) => {
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
      licenseStatus: (courierObj?.license_status as LiveMerchantOfferItem['licenseStatus']) ?? 'none',
      insuranceStatus: (courierObj?.insurance_status as LiveMerchantOfferItem['insuranceStatus']) ?? 'none',
      docLevel: ((courierObj?.doc_level as number) ?? 0) as 0 | 1 | 2,
      createdAt: o.created_at,
      status: o.status as LiveMerchantOfferItem['status'],
    };
  });

  return { ok: true, data: mapped };
}

/**
 * 3.3 Consulta de estado vivo del viaje activo.
 * - Llama exclusivamente a la función RPC getTripDetailsRpc.
 * - Desecha cualquier PII, contacto, dirección, teléfono o avatar.
 * - Retorna SOLO { id: requestId, status } con status en 'matched' | 'in_transit' | 'delivered'.
 * - NOT_FOUND -> { ok: true, data: null }.
 */
export async function getTripLiveStateServer(
  tripId: string
): Promise<LiveServerResult<LiveTripState | null>> {
  const parsedId = z.string().uuid().safeParse(tripId);
  if (!parsedId.success) {
    return { ok: false, error: 'INVALID_TRIP_ID', status: 400 };
  }

  const supabase = await createClient();
  const rpcResult = await getTripDetailsRpc(supabase, { requestId: parsedId.data });
  if (!rpcResult.ok) {
    if (rpcResult.code === 'UNAUTHENTICATED') {
      return { ok: false, error: 'UNAUTHENTICATED', status: 401 };
    }
    if (rpcResult.code === 'NOT_FOUND') {
      return { ok: true, data: null };
    }
    if (rpcResult.code === 'UNAUTHORIZED_ACTOR') {
      return { ok: false, error: 'UNAUTHORIZED_ACTOR', status: 403 };
    }
    if (rpcResult.code === 'INVALID_STATE_TRANSITION') {
      return { ok: false, error: 'INVALID_STATE_TRANSITION', status: 409 };
    }
    return { ok: false, error: rpcResult.code, status: 500 };
  }

  const status = rpcResult.data.status;
  if (status !== 'matched' && status !== 'in_transit' && status !== 'delivered') {
    return { ok: false, error: 'INVALID_STATUS', status: 422 };
  }

  return {
    ok: true,
    data: {
      id: parsedId.data,
      status,
    },
  };
}
