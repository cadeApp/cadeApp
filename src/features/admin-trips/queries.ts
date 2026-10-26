import 'server-only';

import { z } from 'zod';
import type { AdminTripsCursor, AdminTripsFilter } from '@/domain';
import { createClient } from '@/server/supabase/server';
import { adminListTripsRpc } from '@/server/rpc/admin-trips';
import {
  ADMIN_TRIP_EVENT_ACTIONS,
  adminTripDetailSchema,
  type AdminTripDetail,
  type AdminTripsListResult,
} from './types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface GetAdminTripsOptions {
  readonly filter?: AdminTripsFilter;
  readonly cursor?: AdminTripsCursor;
  readonly pageSize?: number;
}

/**
 * T-410: lista paginada vía `admin_list_trips` (CC-037) con el cliente de sesión; el filtro «Con problemas», el
 * keyset y la exigencia de aal2 viven en Postgres.
 */
export async function getAdminTrips(options: GetAdminTripsOptions = {}): Promise<AdminTripsListResult> {
  const { filter = 'problems', cursor, pageSize = DEFAULT_PAGE_SIZE } = options;
  const limit = Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE);

  const client = await createClient();
  const result = await adminListTripsRpc(client, { filter, cursor: cursor ?? null, limit });
  if (!result.ok) {
    // Solo el código de dominio: el error boundary nunca muestra detalles de la base.
    throw new Error(`ADMIN_TRIPS_${result.code}`);
  }

  return { items: result.data.items, pageSize: limit, nextCursor: result.data.nextCursor };
}

interface ProfileRef {
  readonly display_name: string | null;
  readonly phone?: string | null;
  readonly role?: string | null;
}

interface RequestRow {
  readonly id: string;
  readonly status: string;
  readonly created_at: string;
  readonly published_at: string | null;
  readonly matched_at: string | null;
  readonly picked_up_at: string | null;
  readonly delivered_at: string | null;
  readonly cancelled_at: string | null;
  readonly merchant_id: string;
  readonly accepted_offer_id: string | null;
  readonly merchants: { readonly business_name: string | null; readonly profiles: ProfileRef | null } | null;
}

interface DropRow {
  readonly position: number;
  readonly status: string;
  readonly delivered_at: string | null;
  readonly failed_reason: string | null;
  readonly zones: { readonly name: string | null } | null;
}

interface ReasonRow {
  readonly id: string;
  readonly action: string;
  readonly reason: string;
  readonly created_at: string;
  readonly actor: ProfileRef | null;
}

interface IncidentRow {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly created_at: string;
}

interface OfferRow {
  readonly courier_id: string;
  readonly couriers: { readonly profiles: ProfileRef | null } | null;
}

// Columnas explícitas: nunca las tablas de contactos del destinatario, notas, montos de cambio ni coordenadas.
const REQUEST_COLUMNS = [
  'id',
  'status',
  'created_at',
  'published_at',
  'matched_at',
  'picked_up_at',
  'delivered_at',
  'cancelled_at',
  'merchant_id',
  'accepted_offer_id',
  'merchants!delivery_requests_merchant_id_fkey(business_name, profiles!merchants_profile_id_fkey(display_name, phone))',
].join(', ');
const DROP_COLUMNS =
  'position, status, delivered_at, failed_reason, zones!delivery_request_drops_dropoff_zone_id_fkey(name)';
const REASON_COLUMNS =
  'id, action, reason, created_at, actor:profiles!request_cancellation_reasons_actor_id_fkey(display_name, role)';
const INCIDENT_COLUMNS = 'id, kind, status, created_at';
const OFFER_COLUMNS =
  'courier_id, couriers!offers_courier_id_fkey(profiles!couriers_profile_id_fkey(display_name, phone))';

const EVENT_ACTIONS: readonly string[] = ADMIN_TRIP_EVENT_ACTIONS;

function requestCode(id: string): string {
  return `REQ-${id.slice(0, 8).toUpperCase()}`;
}

/**
 * T-410: detalle del viaje leído por la RLS del admin, con las lecturas en paralelo. El resultado se parsea con un
 * schema estricto sin datos del destinatario.
 */
export async function getAdminTripDetail(requestId: string): Promise<AdminTripDetail | null> {
  if (!z.string().guid().safeParse(requestId).success) {
    return null;
  }

  const client = await createClient();
  const [requestRes, dropsRes, reasonsRes, incidentsRes] = await Promise.all([
    client.from('delivery_requests').select(REQUEST_COLUMNS).eq('id', requestId).maybeSingle<RequestRow>(),
    client
      .from('delivery_request_drops')
      .select(DROP_COLUMNS)
      .eq('request_id', requestId)
      .order('position', { ascending: true }),
    client
      .from('request_cancellation_reasons')
      .select(REASON_COLUMNS)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true }),
    client
      .from('incidents')
      .select(INCIDENT_COLUMNS)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false }),
  ]);

  if (requestRes.error || dropsRes.error || reasonsRes.error || incidentsRes.error) {
    throw new Error('ADMIN_TRIP_DETAIL_READ_FAILED');
  }
  const request = requestRes.data;
  if (!request || request.status === 'draft') {
    return null;
  }

  let offer: OfferRow | null = null;
  if (request.accepted_offer_id) {
    const offerRes = await client
      .from('offers')
      .select(OFFER_COLUMNS)
      .eq('id', request.accepted_offer_id)
      .maybeSingle<OfferRow>();
    if (offerRes.error) {
      throw new Error('ADMIN_TRIP_DETAIL_READ_FAILED');
    }
    offer = offerRes.data;
  }

  const merchantProfile = request.merchants?.profiles ?? null;
  const merchantName = request.merchants?.business_name?.trim() || merchantProfile?.display_name || '';

  return adminTripDetailSchema.parse({
    id: request.id,
    code: requestCode(request.id),
    status: request.status,
    createdAt: request.created_at,
    merchant: { id: request.merchant_id, name: merchantName, phone: merchantProfile?.phone ?? null },
    courier: offer
      ? {
          id: offer.courier_id,
          name: offer.couriers?.profiles?.display_name ?? '',
          phone: offer.couriers?.profiles?.phone ?? null,
        }
      : null,
    timeline: {
      publishedAt: request.published_at,
      matchedAt: request.matched_at,
      pickedUpAt: request.picked_up_at,
      deliveredAt: request.delivered_at,
      cancelledAt: request.cancelled_at,
    },
    drops: ((dropsRes.data ?? []) as unknown as DropRow[]).map((drop) => ({
      position: drop.position,
      zoneName: drop.zones?.name ?? '',
      status: drop.status,
      deliveredAt: drop.delivered_at,
      failedReason: drop.failed_reason,
    })),
    events: ((reasonsRes.data ?? []) as unknown as ReasonRow[])
      .filter((row) => EVENT_ACTIONS.includes(row.action))
      .map((row) => ({
        id: row.id,
        action: row.action,
        reason: row.reason,
        createdAt: row.created_at,
        actorName: row.actor?.display_name ?? null,
        actorRole: row.actor?.role ?? null,
      })),
    incidents: ((incidentsRes.data ?? []) as unknown as IncidentRow[]).map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      createdAt: row.created_at,
    })),
  });
}
