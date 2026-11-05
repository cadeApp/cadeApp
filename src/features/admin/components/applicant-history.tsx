import * as React from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { ADMIN_COPY } from '../copy';
import type { ApplicantHistoryEvent } from '../types';
import { buildAuditHref } from './audit-log-table';

export interface ApplicantHistoryProps {
  /** Eventos reales, del más viejo al más nuevo (los ordena el servidor). */
  readonly events: readonly ApplicantHistoryEvent[];
  /** Repartidor del historial: «Ver todo en Auditoría» filtra sus eventos y los de sus documentos. */
  readonly courierId: string;
}

function eventTitle(event: ApplicantHistoryEvent): string {
  if (event.kind === 'registered') return ADMIN_COPY.detail.historyRegistered;
  if (event.kind === 'submitted') return ADMIN_COPY.detail.historySubmitted;
  return event.detail ? `${event.label} · ${event.detail}` : event.label;
}

/** T-404 (A02): línea de tiempo vertical del postulante; no agrega eventos que no vengan de la base. */
export function ApplicantHistory({ events, courierId }: ApplicantHistoryProps) {
  const copy = ADMIN_COPY.detail;
  return (
    <div className="space-y-3">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.historyEmpty}</p>
      ) : (
        <ol aria-label={copy.historyListLabel} className="space-y-4 border-l border-border pl-4">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span aria-hidden="true" className="absolute -left-5 top-1.5 h-2 w-2 rounded-full bg-primary" />
              <p className="text-sm font-medium text-foreground">{eventTitle(event)}</p>
              <p className="text-sm text-muted-foreground">
                <time dateTime={event.at}>{formatDate(event.at, 'dateTime')}</time>
                {event.kind === 'audit' && event.actorName ? ` · ${copy.historyBy(event.actorName)}` : null}
              </p>
              {event.kind === 'audit' && event.reason ? (
                <p className="text-sm text-foreground">{copy.historyReason(event.reason)}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <Link
        href={buildAuditHref({ courierId })}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {copy.historySeeAll}
      </Link>
    </div>
  );
}
