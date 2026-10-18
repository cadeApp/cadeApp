'use client';

import * as React from 'react';
import Link from 'next/link';
import type { RpcOutput } from '@/domain';
import { formatDate } from '@/lib/format';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { formatCivilDate } from '../audit-format';
import { ADMIN_COPY } from '../copy';
import type { AdminMerchantHeader, PublicationPlanItem, PublicationPlansCursor } from '../types';
import { GrantCreditsDialog, RegisterPeriodDialog } from './publication-credits-dialogs';

const COPY = ADMIN_COPY.credits;

type CreditsData = RpcOutput<'admin_get_merchant_publication_credits'>;
type Balance = CreditsData['balance'];
type Lot = Balance['lots'][number];
type Period = NonNullable<Balance['currentPeriod']>;

export interface MerchantCreditsViewProps {
  readonly merchant: AdminMerchantHeader;
  readonly data: CreditsData;
  /** Primera página de planes activos; el diálogo de registro pide las siguientes. */
  readonly plans: readonly PublicationPlanItem[];
  readonly plansNextCursor: PublicationPlansCursor | null;
  /** Cursor de la página actual del libro; si existe, se ofrece volver a los más recientes. */
  readonly currentBeforeId: number | null;
}

/**
 * CC-029: saldo, plan y libro de un comercio para el admin, con acreditación de créditos sueltos y registro de
 * períodos. Todo valor sale de `admin_get_merchant_publication_credits`; la UI no recalcula saldos.
 */
export function MerchantCreditsView({
  merchant,
  data,
  plans,
  plansNextCursor,
  currentBeforeId,
}: MerchantCreditsViewProps) {
  const [dialog, setDialog] = React.useState<'grant' | 'register' | null>(null);
  const { balance, movements, nextCursor } = data;
  const basePath = `/admin/merchants/${merchant.id}/credits`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/merchants"
          className="inline-flex min-h-12 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          {COPY.back}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title(merchant.businessName)}</h1>
        <p className="text-sm text-muted-foreground">{COPY.description}</p>
      </div>

      <Card className="space-y-4 border border-border p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{COPY.mode[balance.mode]}</Badge>
          <Badge variant={balance.canPublish ? 'verified' : 'destructive'}>
            {balance.canPublish ? COPY.canPublish : COPY.cannotPublish}
          </Badge>
          {balance.legacyPaidUntil ? (
            <span className="text-sm text-muted-foreground">
              {COPY.legacyUntil(formatCivilDate(balance.legacyPaidUntil))}
            </span>
          ) : null}
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label={COPY.stats.available} value={balance.available} />
          <Stat label={COPY.stats.reserved} value={balance.reserved} />
          <Stat label={COPY.stats.scheduled} value={balance.scheduled} />
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <PeriodBox title={COPY.currentPeriod} period={balance.currentPeriod} />
          <PeriodBox title={COPY.nextPeriod} period={balance.nextPeriod} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => setDialog('grant')}>
            {COPY.grantButton}
          </Button>
          <Button type="button" variant="outline" onClick={() => setDialog('register')}>
            {COPY.registerButton}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 border border-border p-5 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">{COPY.lotsTitle}</h2>
        {balance.lots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{COPY.lotsEmpty}</p>
        ) : (
          <Table aria-label={COPY.lotsTableLabel}>
            <TableHeader>
              <TableRow>
                <TableHead>{COPY.lotColumns.kind}</TableHead>
                <TableHead className="text-right">{COPY.lotColumns.available}</TableHead>
                <TableHead>{COPY.lotColumns.expires}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balance.lots.map((lot) => (
                <TableRow key={lot.lotId}>
                  <TableCell className="text-sm font-medium">{lotKindLabel(lot)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {lot.available} / {lot.granted}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lotTiming(lot)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="space-y-3 border border-border p-5 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">{COPY.movementsTitle}</h2>
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{COPY.movementsEmpty}</p>
        ) : (
          <Table aria-label={COPY.movementsTableLabel}>
            <TableHeader>
              <TableRow>
                <TableHead>{COPY.movementColumns.date}</TableHead>
                <TableHead>{COPY.movementColumns.kind}</TableHead>
                <TableHead className="text-right">{COPY.movementColumns.amount}</TableHead>
                <TableHead>{COPY.movementColumns.reason}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(movement.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{COPY.movementKind[movement.kind]}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{movement.amount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{movement.reason ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {currentBeforeId !== null || nextCursor !== null ? (
          <nav aria-label={COPY.movementsPagination} className="flex justify-end gap-3">
            {currentBeforeId !== null ? (
              <Link
                href={basePath}
                className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                {COPY.newestMovements}
              </Link>
            ) : null}
            {nextCursor !== null ? (
              <Link
                href={`${basePath}?${new URLSearchParams({ before: String(nextCursor) })}`}
                className="inline-flex min-h-12 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {COPY.olderMovements}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Card>

      <GrantCreditsDialog merchant={merchant} open={dialog === 'grant'} onClose={() => setDialog(null)} />
      <RegisterPeriodDialog
        merchant={merchant}
        plans={plans}
        plansNextCursor={plansNextCursor}
        open={dialog === 'register'}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function PeriodBox({ title, period }: { readonly title: string; readonly period: Period | null }) {
  return (
    <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-sm">
      <p className="font-semibold text-foreground">{title}</p>
      {period ? (
        <>
          <p className="text-foreground">
            {COPY.periodLine(period.planName, formatDate(period.startsAt), formatDate(period.endsAt))}
          </p>
          <p className="text-muted-foreground">
            {period.monthlyCredits === null ? COPY.plansUnlimited : COPY.plansQuota(period.monthlyCredits)}
            {' · '}
            {COPY.streakLine(period.streak, period.carryoverPct)}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">{COPY.noPeriod}</p>
      )}
    </div>
  );
}

function lotKindLabel(lot: Lot): string {
  if (lot.source === 'refund_conversion') return COPY.lotKind.refund;
  return COPY.lotKind[lot.kind];
}

function lotTiming(lot: Lot): string {
  if (!lot.usable && lot.startsAt) return COPY.lotScheduled(formatDate(lot.startsAt));
  return lot.expiresAt ? formatDate(lot.expiresAt) : COPY.neverExpires;
}
