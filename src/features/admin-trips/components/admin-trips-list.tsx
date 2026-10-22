import * as React from 'react';
import Link from 'next/link';
import type { AdminTripsCursor, AdminTripsFilter } from '@/domain';
import { formatDate } from '@/lib/format';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { EmptyState } from '@/ui/empty-state';
import { ADMIN_TRIPS_COPY } from '../copy';
import { tripDeliverySummary, tripProblemBadges } from '../problems';
import { ADMIN_TRIPS_TABS, adminTripsHref } from '../schemas';
import type { AdminTripsListResult } from '../types';
import { AdminTripStatusBadge } from './admin-trip-status-badge';

const COPY = ADMIN_TRIPS_COPY.list;

const LINK_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export interface AdminTripsListProps {
  readonly result: AdminTripsListResult;
  readonly filter: AdminTripsFilter;
  /** Cursor de la página actual; si existe, se ofrece volver al inicio. */
  readonly currentCursor?: AdminTripsCursor;
}

/**
 * T-410: lista de viajes del admin con «Con problemas» y «Todos», paginada por el keyset de `admin_list_trips`.
 */
export function AdminTripsList({ result, filter, currentCursor }: AdminTripsListProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title}</h1>
        <p className="text-sm text-muted-foreground">{COPY.description}</p>
      </div>

      <nav aria-label={COPY.tabsLabel} className="flex gap-2 border-b border-border">
        {ADMIN_TRIPS_TABS.map((option) => {
          const active = option === filter;
          return (
            <Link
              key={option}
              href={adminTripsHref(option)}
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
        <EmptyState title={COPY.emptyTitle[filter]} description={COPY.emptyDescription} />
      ) : (
        <ul aria-label={COPY.listLabel} className="space-y-3">
          {result.items.map((item) => {
            const problems = tripProblemBadges(item);
            const deliveries = tripDeliverySummary(item);
            return (
              <li key={item.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">{item.code}</span>
                      <AdminTripStatusBadge status={item.status} />
                    </div>
                    <p className="break-words text-sm text-foreground">
                      {item.merchantName} → {item.courierName ?? COPY.noCourier}
                    </p>
                    {problems.length > 0 ? (
                      <ul aria-label={`Problemas del viaje ${item.code}`} className="flex flex-wrap gap-2">
                        {problems.map((problem) => (
                          <li key={problem.key}>
                            <Badge variant={problem.variant} className="text-sm">
                              {problem.label}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                      {deliveries ? ` · ${deliveries}` : null}
                    </p>
                  </div>
                  <Link
                    href={`/admin/trips/${item.id}`}
                    aria-label={`${COPY.viewDetail} ${COPY.viewDetailFor(item.code)}`}
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
              href={adminTripsHref(filter)}
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
              href={adminTripsHref(filter, result.nextCursor)}
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
