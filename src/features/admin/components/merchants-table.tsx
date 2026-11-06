'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge, type BadgeProps } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { cn } from '@/ui/cn';
import { formatDate, formatPhone } from '@/lib/format';
import type { MerchantSubscriptionStatus } from '@/domain';
import { formatCivilDate } from '../audit-format';
import { ADMIN_COPY } from '../copy';
import type { AdminMerchantListItem, AdminMerchantsResult, MerchantStatusCounts } from '../types';
import { MerchantPlanSheet } from './merchant-plan-sheet';

const COPY = ADMIN_COPY.merchants;

// T-405: «Piloto» en el verde azulado de marca (`--primary` con `--primary-foreground`, AAA); «Activo» como éxito.
const STATUS_BADGE: Record<MerchantSubscriptionStatus, BadgeProps['variant']> = {
  pilot: 'default',
  active: 'verified',
  expired: 'destructive',
  cancelled: 'outline',
};

const STATUS_CHIPS = ['pilot', 'active', 'expired', 'cancelled'] as const;
const MERCHANTS_PATH = '/admin/merchants';

/** URL de A03 con el chip y el cursor; sin chip es «Todos». */
function merchantsHref(status?: MerchantSubscriptionStatus, cursor?: string): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `${MERCHANTS_PATH}?${query}` : MERCHANTS_PATH;
}

const HEADER_CLASS =
  'px-6 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground';

export interface MerchantsTableProps {
  readonly result: AdminMerchantsResult;
  /** Cursor de la página actual; si existe, se ofrece volver al inicio. */
  readonly currentCursor?: string;
  /** T-405: conteos exactos por estado para los chips. */
  readonly counts: MerchantStatusCounts;
  /** T-405: chip activo; sin valor, «Todos». */
  readonly status?: MerchantSubscriptionStatus;
}

/**
 * A03: chips de resumen por estado, tabla de comercios y panel lateral para marcar un mes pagado o extender el
 * piloto.
 */
export function MerchantsTable({ result, currentCursor, counts, status }: MerchantsTableProps) {
  const [editing, setEditing] = React.useState<AdminMerchantListItem | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title}</h1>
          <p className="text-sm text-muted-foreground">{COPY.description}</p>
        </div>
        <Link
          href="/admin/merchants/plans"
          className="inline-flex min-h-12 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {COPY.plansLink}
        </Link>
      </div>

      <nav aria-label={COPY.chips.label}>
        <ul className="flex flex-wrap gap-2">
          {[undefined, ...STATUS_CHIPS].map((chip) => {
            const selected = chip === status;
            return (
              <li key={chip ?? 'all'}>
                <Link
                  href={merchantsHref(chip)}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-secondary bg-secondary text-secondary-foreground'
                      : 'border-border bg-card text-foreground hover:bg-muted'
                  )}
                >
                  {chip ? COPY.chips[chip] : COPY.chips.all}
                  <span className="tabular-nums">{chip ? counts[chip] : counts.all}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {result.items.length === 0 ? (
        <EmptyState title={COPY.emptyTitle} description={COPY.emptyDescription} />
      ) : (
        <Card className="overflow-hidden border border-border shadow-sm">
          <Table aria-label={COPY.tableLabel}>
            <TableHeader className="bg-muted/70">
              <TableRow>
                <TableHead className={HEADER_CLASS}>{COPY.columns.registered}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.business}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.owner}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.phone}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.zone}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.plan}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.paidUntil}</TableHead>
                <TableHead className={cn(HEADER_CLASS, 'text-right')}>
                  {COPY.columns.delivered}
                </TableHead>
                <TableHead className={cn(HEADER_CLASS, 'text-right')}>
                  <span className="sr-only">{COPY.columns.actions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card">
              {result.items.map((merchant) => (
                <TableRow key={merchant.id} className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {merchant.createdAt ? formatDate(merchant.createdAt) : COPY.empty}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm font-medium text-foreground">
                    {merchant.signupIncomplete ? (
                      <>
                        <span className="block">{merchant.ownerName || COPY.empty}</span>
                        <span className="block text-sm font-normal text-muted-foreground">
                          {merchant.businessName}
                        </span>
                      </>
                    ) : (
                      merchant.businessName
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-foreground">
                    {merchant.ownerName || COPY.empty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {merchant.phone ? formatPhone(merchant.phone) : COPY.empty}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-foreground">
                    {merchant.pickupZoneName ?? COPY.empty}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant={STATUS_BADGE[merchant.subscriptionStatus]}>
                      {COPY.status[merchant.subscriptionStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {merchant.paidUntil ? formatCivilDate(merchant.paidUntil) : COPY.empty}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right text-sm font-semibold tabular-nums">
                    {merchant.deliveredCount}
                  </TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap px-6 py-4 text-right">
                    <Link
                      href={`/admin/merchants/${merchant.id}/credits`}
                      className="inline-flex min-h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {COPY.credits}
                      <span className="sr-only"> {COPY.creditsFor(merchant.businessName)}</span>
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(merchant)}
                    >
                      {COPY.editPlan}
                      <span className="sr-only"> {COPY.editPlanFor(merchant.businessName)}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {currentCursor || (result.hasNextPage && result.nextCursor) ? (
        <nav className="flex items-center justify-end gap-3" aria-label={COPY.paginationLabel}>
          {currentCursor ? (
            <Link
              href={merchantsHref(status)}
              className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COPY.firstPage}
            </Link>
          ) : null}
          {result.hasNextPage && result.nextCursor ? (
            <Link
              href={merchantsHref(status, result.nextCursor)}
              className="inline-flex min-h-12 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COPY.nextButton}
            </Link>
          ) : null}
        </nav>
      ) : null}

      <MerchantPlanSheet merchant={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
