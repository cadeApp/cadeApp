'use client';

import * as React from 'react';
import type { RequestCancellationHistory, RequestCancellationHistoryEvent } from '@/domain';
import { formatDate } from '@/lib/format';
import { Button } from '@/ui/button';
import { loadCancellationHistoryPageAction } from '../actions';
import { CANCELLATION_HISTORY_COPY } from '../cancellation-history-copy';

type HistoryCursor = RequestCancellationHistory['pagination']['nextCursor'];

export interface CancellationHistoryListProps {
  requestId: string;
  initialEvents: readonly RequestCancellationHistoryEvent[];
  initialNextCursor: HistoryCursor;
}

/**
 * T-373: cronología de cancelaciones de asignación, en el orden de la RPC (más reciente primero). «Ver más» pide la
 * página siguiente con el cursor keyset que devolvió la anterior; un evento repetido no se duplica.
 */
export function CancellationHistoryList({
  requestId,
  initialEvents,
  initialNextCursor,
}: CancellationHistoryListProps) {
  const [events, setEvents] = React.useState<readonly RequestCancellationHistoryEvent[]>(initialEvents);
  const [nextCursor, setNextCursor] = React.useState<HistoryCursor>(initialNextCursor);
  const [loadError, setLoadError] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const loadMore = () => {
    if (!nextCursor) return;
    setLoadError(false);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof loadCancellationHistoryPageAction>>;
      try {
        result = await loadCancellationHistoryPageAction({ requestId, cursor: nextCursor });
      } catch {
        setLoadError(true);
        return;
      }
      if (!result.ok) {
        setLoadError(true);
        return;
      }
      const page = result.data;
      setEvents((current) => {
        const seen = new Set(current.map((event) => event.id));
        return [...current, ...page.events.filter((event) => !seen.has(event.id))];
      });
      setNextCursor(page.pagination.nextCursor);
    });
  };

  return (
    <div className="space-y-3">
      <ol className="space-y-2" aria-label={CANCELLATION_HISTORY_COPY.title}>
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-semibold text-foreground">{event.actionLabel}</p>
            <p className="text-foreground">{event.categoryLabel}</p>
            <p className="text-muted-foreground">
              <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
              {' · '}
              {event.actor?.displayName ?? CANCELLATION_HISTORY_COPY.unknownActor}
            </p>
          </li>
        ))}
      </ol>
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {CANCELLATION_HISTORY_COPY.loadMoreError}
        </p>
      ) : null}
      {nextCursor ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={loadMore}
          isPending={isPending}
          pendingText={CANCELLATION_HISTORY_COPY.loadingMore}
        >
          {loadError ? CANCELLATION_HISTORY_COPY.retry : CANCELLATION_HISTORY_COPY.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
