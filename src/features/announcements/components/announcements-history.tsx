import * as React from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import type { AdminAnnouncementItem, AdminAnnouncementsCursor, ActionResult, DomainErrorCode } from '@/domain';
import { formatDate } from '@/lib/format';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { ANNOUNCEMENTS_COPY } from '../copy';
import { adminAnnouncementsHref } from '../schemas';

const COPY = ANNOUNCEMENTS_COPY.admin;

export interface AnnouncementsHistoryProps {
  readonly result: ActionResult<
    { readonly items: readonly AdminAnnouncementItem[]; readonly nextCursor: AdminAnnouncementsCursor | null },
    DomainErrorCode
  >;
  readonly isFirstPage: boolean;
}

function pushLabel(item: AdminAnnouncementItem): string {
  if (item.pushTargets === null || item.pushSent === null || item.pushFailed === null) return COPY.pushPending;
  return COPY.pushSummary(item.pushSent, item.pushFailed, item.pushTargets);
}

/** CC-040 (T-414): novedades enviadas, de la más reciente a la más vieja, paginadas por keyset. */
export function AnnouncementsHistory({ result, isFirstPage }: AnnouncementsHistoryProps) {
  // El enlace a la página siguiente se arma antes del JSX (regla de route-integrity).
  const nextHref = result.ok && result.data.nextCursor ? adminAnnouncementsHref(result.data.nextCursor) : null;
  const linkClass =
    'inline-flex min-h-12 items-center rounded-lg px-3 text-sm font-medium underline-offset-4 hover:underline';

  return (
    <section aria-labelledby="announcements-history-title" className="space-y-3">
      <h2 id="announcements-history-title" className="font-display text-lg font-bold text-foreground">
        {COPY.historyTitle}
      </h2>

      {!result.ok ? (
        <Card role="alert" className="flex items-start gap-3 p-5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{COPY.historyError}</p>
        </Card>
      ) : result.data.items.length === 0 ? (
        <EmptyState title={COPY.historyTitle} description={COPY.historyEmpty} />
      ) : (
        <Card className="overflow-hidden border border-border shadow-sm">
          <Table aria-label={COPY.historyLabel}>
            <TableHeader className="bg-muted/70">
              <TableRow>
                <TableHead>{COPY.columns.title}</TableHead>
                <TableHead>{COPY.columns.audience}</TableHead>
                <TableHead>{COPY.columns.visibleUntil}</TableHead>
                <TableHead>{COPY.columns.push}</TableHead>
                <TableHead>{COPY.columns.createdBy}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-md">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  </TableCell>
                  <TableCell className="text-sm">{COPY.audience[item.audience]}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(item.visibleUntil)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">{pushLabel(item)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.createdByName || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {result.ok && (result.data.nextCursor || !isFirstPage) ? (
        <nav aria-label={COPY.paginationLabel} className="flex flex-wrap justify-between gap-3">
          {!isFirstPage ? (
            <Link href="/admin/announcements" className={`${linkClass} text-muted-foreground`}>
              {COPY.first}
            </Link>
          ) : (
            <span />
          )}
          {nextHref ? (
            <Link href={nextHref} className={`${linkClass} text-foreground`}>
              {COPY.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
