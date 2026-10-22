import * as React from 'react';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { formatDate, formatPhone } from '@/lib/format';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { ADMIN_TRIPS_COPY } from '../copy';
import {
  buildTripTimeline,
  dropDisplayStatus,
  tripDeliverySummary,
  tripDropsForDisplay,
  type DropDisplayStatus,
  type TimelineTone,
} from '../problems';
import type { AdminTripDetail } from '../types';
import { AdminTripStatusBadge } from './admin-trip-status-badge';

const COPY = ADMIN_TRIPS_COPY.detail;

const LINK_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const DROP_BADGE = {
  delivered: 'delivered',
  failed: 'destructive',
  pending: 'outline',
  notDelivered: 'cancelled',
} as const satisfies Record<DropDisplayStatus, 'delivered' | 'destructive' | 'outline' | 'cancelled'>;

const TONE_DOT: Record<TimelineTone, string> = {
  default: 'bg-border',
  success: 'bg-primary',
  warning: 'bg-muted-foreground',
  danger: 'bg-destructive',
};

function displayPhone(phone: string): string {
  try {
    return formatPhone(phone);
  } catch {
    return phone;
  }
}

function PartyCard({ label, party }: { readonly label: string; readonly party: AdminTripDetail['merchant'] }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="break-words text-base font-semibold text-foreground">{party.name}</p>
      </div>
      {party.phone ? (
        <a
          href={`tel:${party.phone.replace(/[^\d+]/g, '')}`}
          aria-label={COPY.call(party.name)}
          className={cn(
            'inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted',
            LINK_FOCUS
          )}
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          {displayPhone(party.phone)}
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">{COPY.noPhone}</p>
      )}
    </div>
  );
}

export interface AdminTripDetailViewProps {
  readonly trip: AdminTripDetail;
}

/**
 * T-410: detalle del viaje para mediar: partes con teléfono, cronología con cada motivo, resultado de cada entrega e
 * incidentes. Sin datos del destinatario.
 */
export function AdminTripDetailView({ trip }: AdminTripDetailViewProps) {
  const timeline = buildTripTimeline(trip);
  const drops = tripDropsForDisplay(trip);
  const deliveries = tripDeliverySummary({
    status: trip.status,
    dropsCount: drops.length,
    deliveredDrops: drops.filter((drop) => drop.status === 'delivered').length,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/trips"
        className={cn(
          'inline-flex min-h-12 items-center text-sm font-medium text-muted-foreground hover:text-foreground',
          LINK_FOCUS
        )}
      >
        {COPY.back}
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">{trip.code}</h1>
          <AdminTripStatusBadge status={trip.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <time dateTime={trip.createdAt}>{formatDate(trip.createdAt)}</time>
          {deliveries ? ` · ${deliveries}` : null}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-3 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">{COPY.dropsTitle}</h2>
            <ol className="space-y-3">
              {drops.map((drop) => {
                const display = dropDisplayStatus(drop, trip.status);
                return (
                  <li key={drop.position} className="space-y-1 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {COPY.dropTitle(drop.position)}
                        {drop.zoneName ? <span className="font-normal text-muted-foreground"> · {drop.zoneName}</span> : null}
                      </h3>
                      <Badge variant={DROP_BADGE[display]} className="text-sm">
                        {COPY.dropStatus[display]}
                      </Badge>
                    </div>
                    {drop.status === 'failed' && drop.failedReason ? (
                      <p className="break-words text-sm font-semibold text-destructive">
                        {COPY.reason(drop.failedReason)}
                      </p>
                    ) : null}
                    {drop.deliveredAt ? (
                      <time dateTime={drop.deliveredAt} className="block text-sm text-muted-foreground">
                        {formatDate(drop.deliveredAt)}
                      </time>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card className="space-y-3 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">{COPY.timelineTitle}</h2>
            <ol className="space-y-3">
              {timeline.map((entry) => (
                <li key={entry.key} className="flex gap-3">
                  <span aria-hidden="true" className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[entry.tone])} />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                    {entry.detail ? <p className="break-words text-sm text-foreground">{entry.detail}</p> : null}
                    <time dateTime={entry.at} className="block text-sm text-muted-foreground">
                      {formatDate(entry.at)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">{COPY.partiesTitle}</h2>
            <PartyCard label={COPY.merchant} party={trip.merchant} />
            {trip.courier ? (
              <PartyCard label={COPY.courier} party={trip.courier} />
            ) : (
              <p className="text-sm text-muted-foreground">{COPY.noCourier}</p>
            )}
          </Card>

          <Card className="space-y-3 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">{COPY.incidentsTitle}</h2>
            {trip.incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.noIncidents}</p>
            ) : (
              <ul className="space-y-3">
                {trip.incidents.map((incident) => (
                  <li key={incident.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        {ADMIN_TRIPS_COPY.incidentKind[incident.kind]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ADMIN_TRIPS_COPY.incidentStatus[incident.status]} ·{' '}
                        <time dateTime={incident.createdAt}>{formatDate(incident.createdAt)}</time>
                      </p>
                    </div>
                    <Link
                      href={`/admin/incidents/${incident.id}`}
                      className={cn(
                        'inline-flex min-h-12 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted',
                        LINK_FOCUS
                      )}
                    >
                      {COPY.viewIncident}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
