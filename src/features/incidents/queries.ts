import 'server-only';

import { z } from 'zod';
import { createClient } from '@/server/supabase/server';
import { adminListIncidentsRpc } from '@/server/rpc/admin';
import type { IncidentsCursor } from '@/domain';
import { INCIDENT_TAB_STATUSES, type IncidentInboxTab } from './schemas';
import { incidentDetailSchema, type IncidentDetail, type IncidentsQueueResult } from './types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface GetIncidentsQueueOptions {
  readonly tab?: IncidentInboxTab;
  readonly cursor?: IncidentsCursor;
  readonly pageSize?: number;
}

/**
 * A05: bandeja paginada vía `admin_list_incidents` (CC-012) con el cliente de sesión; el keyset
 * `created_at DESC, id DESC` y la exigencia de aal2 viven en Postgres.
 */
export async function getIncidentsQueue(
  options: GetIncidentsQueueOptions = {}
): Promise<IncidentsQueueResult> {
  const { tab = 'open', cursor, pageSize = DEFAULT_PAGE_SIZE } = options;
  const limit = Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE);

  const client = await createClient();
  const result = await adminListIncidentsRpc(client, {
    statuses: INCIDENT_TAB_STATUSES[tab],
    cursor: cursor ?? null,
    limit,
  });
  if (!result.ok) {
    // Solo el código de dominio: el error boundary nunca muestra detalles de la base.
    throw new Error(`INCIDENTS_QUEUE_${result.code}`);
  }

  return { items: result.data.items, pageSize: limit, nextCursor: result.data.nextCursor };
}

interface ProfileRef {
  readonly display_name: string | null;
  readonly phone?: string | null;
  readonly role?: string;
}

interface IncidentDetailRow {
  readonly id: string;
  readonly request_id: string;
  readonly kind: string;
  readonly description: string;
  readonly status: string;
  readonly resolution: string | null;
  readonly created_at: string;
  readonly reporter: ProfileRef | null;
  readonly delivery_requests: {
    readonly merchant_id: string;
    readonly published_at: string | null;
    readonly matched_at: string | null;
    readonly picked_up_at: string | null;
    readonly delivered_at: string | null;
    readonly cancelled_at: string | null;
    readonly merchants: { readonly profiles: ProfileRef | null } | null;
  } | null;
}

interface AcceptedOfferRow {
  readonly courier_id: string;
  readonly couriers: { readonly status: string; readonly profiles: ProfileRef | null } | null;
}

// Columnas explícitas: nunca contactos del destinatario, direcciones ni coordenadas.
const INCIDENT_DETAIL_COLUMNS = [
  'id',
  'request_id',
  'kind',
  'description',
  'status',
  'resolution',
  'created_at',
  'reporter:profiles!incidents_reporter_id_fkey(display_name, role)',
  'delivery_requests!incidents_request_id_fkey(merchant_id, published_at, matched_at, picked_up_at, delivered_at, cancelled_at, merchants!delivery_requests_merchant_id_fkey(profiles!merchants_profile_id_fkey(display_name, phone)))',
].join(', ');

const ACCEPTED_OFFER_COLUMNS =
  'courier_id, couriers!offers_courier_id_fkey(status, profiles!couriers_profile_id_fkey(display_name, phone))';

/**
 * A05: detalle del incidente con las partes del viaje y su cronología, leído con la RLS del admin.
 * Nunca datos del destinatario: el resultado se parsea con un schema estricto sin esos campos.
 */
export async function getIncidentDetail(incidentId: string): Promise<IncidentDetail | null> {
  if (!z.string().uuid().safeParse(incidentId).success) {
    return null;
  }

  const client = await createClient();
  const { data: incident, error } = await client
    .from('incidents')
    .select(INCIDENT_DETAIL_COLUMNS)
    .eq('id', incidentId)
    .maybeSingle<IncidentDetailRow>();

  if (error) {
    throw new Error('INCIDENT_DETAIL_READ_FAILED');
  }
  if (!incident || !incident.delivery_requests) {
    return null;
  }

  const { data: offer, error: offerError } = await client
    .from('offers')
    .select(ACCEPTED_OFFER_COLUMNS)
    .eq('request_id', incident.request_id)
    .eq('status', 'accepted')
    .maybeSingle<AcceptedOfferRow>();

  if (offerError) {
    throw new Error('INCIDENT_DETAIL_READ_FAILED');
  }

  const request = incident.delivery_requests;
  const merchantProfile = request.merchants?.profiles ?? null;

  return incidentDetailSchema.parse({
    id: incident.id,
    requestId: incident.request_id,
    kind: incident.kind,
    description: incident.description,
    status: incident.status,
    resolution: incident.resolution,
    createdAt: incident.created_at,
    reporterRole: incident.reporter?.role,
    reporterName: incident.reporter?.display_name ?? '',
    merchant: {
      id: request.merchant_id,
      name: merchantProfile?.display_name ?? '',
      phone: merchantProfile?.phone ?? null,
    },
    courier: offer
      ? {
          id: offer.courier_id,
          name: offer.couriers?.profiles?.display_name ?? '',
          phone: offer.couriers?.profiles?.phone ?? null,
        }
      : null,
    courierSuspended: offer?.couriers?.status === 'suspended',
    timeline: {
      publishedAt: request.published_at,
      matchedAt: request.matched_at,
      pickedUpAt: request.picked_up_at,
      deliveredAt: request.delivered_at,
      cancelledAt: request.cancelled_at,
    },
  });
}
