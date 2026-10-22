import { ADMIN_TRIPS_COPY } from './copy';
import type { AdminTripDetail, AdminTripListItem } from './types';

const COPY = ADMIN_TRIPS_COPY;

export type TripBadgeVariant = 'destructive' | 'partial' | 'cancelled' | 'outline';

export interface TripProblemBadge {
  readonly key: 'failedDrops' | 'courierReleases' | 'noShow' | 'cancelled' | 'incidents';
  readonly label: string;
  readonly variant: TripBadgeVariant;
}

/** T-410: etiquetas de problema de una fila de la lista, en orden fijo y con su conteo. */
export function tripProblemBadges(item: AdminTripListItem): TripProblemBadge[] {
  const badges: TripProblemBadge[] = [];
  if (item.failedDrops > 0) {
    badges.push({ key: 'failedDrops', label: COPY.problems.failedDrops(item.failedDrops), variant: 'destructive' });
  }
  if (item.courierReleases > 0) {
    badges.push({
      key: 'courierReleases',
      label: COPY.problems.courierReleases(item.courierReleases),
      variant: 'partial',
    });
  }
  if (item.noShowReports > 0) {
    badges.push({ key: 'noShow', label: COPY.problems.noShow, variant: 'partial' });
  }
  if (item.cancelled) {
    badges.push({ key: 'cancelled', label: COPY.problems.cancelled, variant: 'cancelled' });
  }
  if (item.openIncidents > 0) {
    badges.push({ key: 'incidents', label: COPY.problems.openIncidents(item.openIncidents), variant: 'destructive' });
  } else if (item.incidents > 0) {
    badges.push({ key: 'incidents', label: COPY.problems.incidents(item.incidents), variant: 'outline' });
  }
  return badges;
}

/** «N de M entregadas» al cerrar; antes, solo cuántas entregas tiene si son varias. */
export function tripDeliverySummary(
  item: Pick<AdminTripListItem, 'status' | 'dropsCount' | 'deliveredDrops'>
): string | null {
  if (item.status === 'delivered') return COPY.deliveries.summary(item.deliveredDrops, item.dropsCount);
  if (item.dropsCount > 1) return COPY.deliveries.count(item.dropsCount);
  return null;
}

/**
 * PR510-H01: entregas a mostrar en el detalle. Una solicitud legacy sin filas en `delivery_request_drops` cuenta como
 * una entrega (igual que `admin_list_trips`), con el resultado que indica el estado de la solicitud.
 */
export function tripDropsForDisplay(detail: AdminTripDetail): AdminTripDetail['drops'] {
  if (detail.drops.length > 0) return detail.drops;
  const delivered = detail.status === 'delivered';
  return [
    {
      position: 1,
      zoneName: '',
      status: delivered ? 'delivered' : 'pending',
      deliveredAt: delivered ? detail.timeline.deliveredAt : null,
      failedReason: null,
    },
  ];
}

export type DropDisplayStatus = 'pending' | 'delivered' | 'failed' | 'notDelivered';

/** Una entrega todavía pendiente en una solicitud cancelada o vencida ya no se va a hacer: «Sin entregar». */
export function dropDisplayStatus(
  drop: Pick<AdminTripDetail['drops'][number], 'status'>,
  requestStatus: AdminTripDetail['status']
): DropDisplayStatus {
  if (drop.status === 'pending' && (requestStatus === 'cancelled' || requestStatus === 'expired')) {
    return 'notDelivered';
  }
  return drop.status;
}

export type TimelineTone = 'default' | 'success' | 'warning' | 'danger';

export interface TimelineEntry {
  readonly key: string;
  readonly at: string;
  readonly title: string;
  readonly detail: string | null;
  readonly tone: TimelineTone;
}

/**
 * T-410: cronología del viaje en orden temporal: hitos de la solicitud, cada evento de
 * `request_cancellation_reasons` con su motivo y cada entrega entregada. Las entregas no realizadas no tienen hora
 * propia: se muestran con su motivo en la sección de entregas.
 */
export function buildTripTimeline(detail: AdminTripDetail): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const { timeline } = detail;
  const milestone = (key: string, at: string | null, title: string, tone: TimelineTone) => {
    if (at) entries.push({ key, at, title, detail: null, tone });
  };

  milestone('published', timeline.publishedAt, COPY.timeline.published, 'default');
  milestone('matched', timeline.matchedAt, COPY.timeline.matched, 'default');
  milestone('picked-up', timeline.pickedUpAt, COPY.timeline.pickedUp, 'default');
  milestone('delivered', timeline.deliveredAt, COPY.timeline.delivered, 'success');
  milestone('cancelled', timeline.cancelledAt, COPY.timeline.cancelled, 'danger');

  for (const drop of detail.drops) {
    if (drop.status === 'delivered' && drop.deliveredAt) {
      entries.push({
        key: `drop-${drop.position}`,
        at: drop.deliveredAt,
        title: COPY.timeline.dropDelivered(drop.position),
        detail: null,
        tone: 'success',
      });
    }
  }

  for (const event of detail.events) {
    if (event.action === 'courier_cancel_match') {
      entries.push({
        key: event.id,
        at: event.createdAt,
        title: COPY.timeline.courierReleased(event.actorName || COPY.timeline.courierFallback),
        detail: COPY.detail.reason(event.reason),
        tone: 'warning',
      });
    } else if (event.action === 'report_no_show') {
      entries.push({ key: event.id, at: event.createdAt, title: COPY.timeline.noShow, detail: null, tone: 'warning' });
    } else {
      entries.push({
        key: event.id,
        at: event.createdAt,
        title: event.actorRole === 'admin' ? COPY.timeline.cancelledByAdmin : COPY.timeline.cancelledByMerchant,
        detail: COPY.detail.reason(event.reason),
        tone: 'danger',
      });
    }
  }

  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
