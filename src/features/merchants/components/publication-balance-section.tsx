import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, CalendarClock, Coins } from 'lucide-react';
import type { ActionResult, DomainErrorCode, PublicationBalance } from '@/domain';
import { formatDate } from '@/lib/format';
import { Badge, type BadgeProps } from '@/ui/badge';
import { buttonVariants } from '@/ui/button';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { formatCivilDateEsAr, publicationBalanceCopy as COPY } from '../copy';

type Mode = PublicationBalance['mode'];
type Lot = PublicationBalance['lots'][number];
type Period = NonNullable<PublicationBalance['currentPeriod']>;

const MODE_BADGE: Record<Mode, BadgeProps['variant']> = {
  pilot: 'published',
  legacy_paid: 'verified',
  unlimited: 'verified',
  credits: 'outline',
};

export interface PublicationBalanceSectionProps {
  readonly result: ActionResult<PublicationBalance, DomainErrorCode>;
}

/**
 * C08 / CC-029: estado de publicación del comercio con los datos de `get_my_publication_balance`. Solo muestra lo que
 * devuelve la RPC: el backend calcula vigencias, arrastre, prioridad y saldo.
 */
export function PublicationBalanceSection({ result }: PublicationBalanceSectionProps) {
  return (
    <section aria-labelledby="publication-balance-title" className="space-y-3 pt-1">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="publication-balance-title"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          {COPY.sectionTitle}
        </h2>
        {result.ok ? (
          <Badge variant={MODE_BADGE[result.data.mode]} className="px-2.5 py-0.5 text-sm font-semibold">
            {COPY.modeBadge[result.data.mode]}
          </Badge>
        ) : null}
      </div>
      {result.ok ? <BalanceDetails balance={result.data} /> : <BalanceError />}
    </section>
  );
}

function BalanceError() {
  return (
    <Card role="alert" className="space-y-3 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="font-display text-base font-bold text-foreground">{COPY.errorTitle}</h3>
          <p className="text-sm text-muted-foreground">{COPY.errorDescription}</p>
        </div>
      </div>
      <Link
        href="/merchant/plan"
        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto')}
      >
        {COPY.retry}
      </Link>
    </Card>
  );
}

function headlineFor(balance: PublicationBalance): { headline: string; description: string } {
  if (balance.canPublish) {
    return { headline: COPY.modeHeadline[balance.mode], description: COPY.modeDescription[balance.mode] };
  }
  if (balance.subscriptionStatus === 'cancelled') {
    return { headline: COPY.blockedHeadline.cancelled, description: COPY.blockedDescription.cancelled };
  }
  if (balance.available === 0) {
    return { headline: COPY.blockedHeadline.noCredits, description: COPY.blockedDescription.noCredits };
  }
  return { headline: COPY.blockedHeadline.notEnabled, description: COPY.blockedDescription.notEnabled };
}

function BalanceDetails({ balance }: { readonly balance: PublicationBalance }) {
  const { headline, description } = headlineFor(balance);

  return (
    <>
      <Card
        className={cn(
          'space-y-4 bg-card p-5 shadow-sm sm:p-6',
          balance.canPublish ? 'border-primary/20' : 'border-destructive/30'
        )}
      >
        <div className="space-y-1">
          <h3 className="font-display text-xl font-bold text-foreground">{headline}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          {balance.mode === 'legacy_paid' && balance.legacyPaidUntil ? (
            <p className="text-sm font-medium text-foreground">
              {COPY.legacyUntil(formatCivilDateEsAr(balance.legacyPaidUntil))}
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-3 border-y border-border/60 py-3 sm:grid-cols-3">
          <Stat label={COPY.stats.available} value={balance.available} />
          <Stat label={COPY.stats.reserved} value={balance.reserved} />
          {balance.scheduled > 0 ? <Stat label={COPY.stats.scheduled} value={balance.scheduled} /> : null}
        </dl>

        {balance.mode === 'pilot' ? (
          <p className="text-sm text-muted-foreground">{COPY.pilotCreditsNote}</p>
        ) : null}

        {balance.currentPeriod ? (
          <PeriodRow title={COPY.currentPeriodTitle} period={balance.currentPeriod} current />
        ) : null}
        {balance.nextPeriod ? (
          <PeriodRow title={COPY.nextPeriodTitle} period={balance.nextPeriod} current={false} />
        ) : null}
      </Card>

      <Card className="space-y-3 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <Coins className="h-4 w-4 text-primary-dark" aria-hidden="true" />
          {COPY.lotsTitle}
        </h3>
        {balance.lots.length === 0 ? (
          // Sin role="status": un listado vacío no es un aviso en vivo (la página ya tiene el suyo).
          <div className="space-y-1 rounded-lg bg-muted/60 p-3.5 text-sm">
            <p className="font-semibold text-foreground">{COPY.emptyTitle}</p>
            <p className="text-muted-foreground">{COPY.emptyDescription}</p>
          </div>
        ) : (
          <Table aria-label={COPY.lotsTableLabel}>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm">{COPY.lotsColumns.kind}</TableHead>
                <TableHead className="text-right text-sm">{COPY.lotsColumns.available}</TableHead>
                <TableHead className="text-sm">{COPY.lotsColumns.expires}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balance.lots.map((lot) => (
                <TableRow key={lot.lotId}>
                  <TableCell className="text-sm font-medium text-foreground">{lotKindLabel(lot)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-foreground">
                    {COPY.lotAvailable(lot.available, lot.granted)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lotTiming(lot)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-display text-base font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function PeriodRow({
  title,
  period,
  current,
}: {
  readonly title: string;
  readonly period: Period;
  readonly current: boolean;
}) {
  const from = formatDate(period.startsAt);
  const to = formatDate(period.endsAt);
  return (
    <div className="space-y-1 rounded-lg bg-muted/60 p-3.5 text-sm">
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <CalendarClock className="h-4 w-4 text-primary-dark" aria-hidden="true" />
        {title}: {period.planName}
      </p>
      <p className="text-muted-foreground">
        {period.planKind === 'unlimited' || period.monthlyCredits === null
          ? COPY.periodUnlimited
          : COPY.periodQuota(period.monthlyCredits)}
        {' · '}
        {current ? COPY.periodRange(from, to) : COPY.periodStarts(from)}
      </p>
      {current && period.streak > 1 ? (
        <p className="text-muted-foreground">{COPY.streak(period.streak, period.carryoverPct)}</p>
      ) : null}
    </div>
  );
}

function lotKindLabel(lot: Lot): string {
  if (lot.source === 'refund_conversion') return COPY.lotKind.refund;
  return COPY.lotKind[lot.kind];
}

function lotTiming(lot: Lot): string {
  if (!lot.usable && lot.startsAt) return COPY.lotScheduled(formatDate(lot.startsAt));
  if (lot.expiresAt) return COPY.lotExpires(formatDate(lot.expiresAt));
  return COPY.lotNeverExpires;
}
