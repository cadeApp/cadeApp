import * as React from 'react';
import Link from 'next/link';
import type { IncidentsCursor } from '@/domain';
import { formatDate } from '@/lib/format';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { EmptyState } from '@/ui/empty-state';
import { INCIDENTS_COPY } from '../copy';
import { INCIDENT_INBOX_TABS, incidentsInboxHref, type IncidentInboxTab } from '../schemas';
import type { IncidentsQueueResult } from '../types';
import { IncidentStatusBadge } from './incident-status-badge';

const COPY = INCIDENTS_COPY.inbox;

const LINK_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export interface IncidentsInboxProps {
  readonly result: IncidentsQueueResult;
  readonly tab: IncidentInboxTab;
  /** Cursor de la página actual; si existe, se ofrece volver al inicio. */
  readonly currentCursor?: IncidentsCursor;
}

/**
 * A05: bandeja de incidentes con pestañas por estado, paginada por el keyset compuesto de `admin_list_incidents`.
 */
export function IncidentsInbox({ result, tab, currentCursor }: IncidentsInboxProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title}</h1>
        <p className="text-sm text-muted-foreground">{COPY.description}</p>
      </div>

      <nav aria-label={COPY.tabsLabel} className="flex gap-2 border-b border-border">
        {INCIDENT_INBOX_TABS.map((option) => {
          const active = option === tab;
          return (
            <Link
              key={option}
              href={incidentsInboxHref(option)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-12 items-center border-b-2 px-4 text-sm font-semibold',
                LINK_FOCUS,
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {COPY.tabs[option]}
            </Link>
          );
        })}
      </nav>

      {result.items.length === 0 ? (
        <EmptyState title={COPY.emptyTitle[tab]} description={COPY.emptyDescription} />
      ) : (
        <ul aria-label={COPY.listLabel} className="space-y-3">
          {result.items.map((item) => {
            const kind = INCIDENTS_COPY.kinds[item.kind];
            const role = INCIDENTS_COPY.roles[item.reporterRole];
            return (
              <li key={item.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.kind === 'safety' ? (
                        <Badge variant="destructive">{kind}</Badge>
                      ) : (
                        <span className="text-base font-semibold text-foreground">{kind}</span>
                      )}
                      <IncidentStatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{COPY.reportedBy(role, item.reporterName)}</p>
                    <p className="line-clamp-2 break-words text-sm text-foreground">{item.description}</p>
                    <time dateTime={item.createdAt} className="block text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </time>
                  </div>
                  <Link
                    href={`/admin/incidents/${item.id}`}
                    aria-label={`${COPY.viewDetail} ${COPY.viewDetailFor(kind, item.reporterName)}`}
                    className={cn(
                      'inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted',
                      LINK_FOCUS
                    )}
                  >
                    {COPY.viewDetail}
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {currentCursor || result.nextCursor ? (
        <nav aria-label={COPY.paginationLabel} className="flex items-center justify-end gap-3">
          {currentCursor ? (
            <Link
              href={incidentsInboxHref(tab)}
              className={cn(
                'inline-flex min-h-12 items-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline',
                LINK_FOCUS
              )}
            >
              {COPY.firstPage}
            </Link>
          ) : null}
          {result.nextCursor ? (
            <Link
              href={incidentsInboxHref(tab, result.nextCursor)}
              className={cn(
                'inline-flex min-h-12 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted',
                LINK_FOCUS
              )}
            >
              {COPY.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
