'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge, type BadgeProps } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { EmptyState } from '@/ui/empty-state';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { cn } from '@/ui/cn';
import { formatPhone } from '@/lib/format';
import { getDomainErrorMessage } from '@/lib/error-messages';
import type { MerchantSubscriptionStatus } from '@/domain';
import { setMerchantSubscriptionAction } from '../actions';
import { formatCivilDate } from '../audit-format';
import { ADMIN_COPY } from '../copy';
import {
  MERCHANT_PLAN_MODES,
  merchantPlanFormSchema,
  type MerchantPlanFormInput,
  type MerchantPlanMode,
} from '../schemas';
import type { AdminMerchantListItem, AdminMerchantsResult } from '../types';

const COPY = ADMIN_COPY.merchants;

const STATUS_BADGE: Record<MerchantSubscriptionStatus, BadgeProps['variant']> = {
  pilot: 'secondary',
  active: 'default',
  expired: 'destructive',
  cancelled: 'outline',
};

const MODE_STATUS: Record<MerchantPlanMode, MerchantSubscriptionStatus> = {
  paid: 'active',
  pilot: 'pilot',
};

const HEADER_CLASS =
  'px-6 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground';

export interface MerchantsTableProps {
  readonly result: AdminMerchantsResult;
  /** Cursor de la página actual; si existe, se ofrece volver al inicio. */
  readonly currentCursor?: string;
}

/**
 * A03: tabla de comercios con Dialog para marcar un mes pagado o extender el piloto.
 */
export function MerchantsTable({ result, currentCursor }: MerchantsTableProps) {
  const [editing, setEditing] = React.useState<AdminMerchantListItem | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title}</h1>
        <p className="text-sm text-muted-foreground">{COPY.description}</p>
      </div>

      {result.items.length === 0 ? (
        <EmptyState title={COPY.emptyTitle} description={COPY.emptyDescription} />
      ) : (
        <Card className="overflow-hidden border border-border shadow-sm">
          <Table aria-label={COPY.tableLabel}>
            <TableHeader className="bg-muted/70">
              <TableRow>
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
                  <TableCell className="px-6 py-4 text-sm font-medium text-foreground">
                    {merchant.businessName}
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
                  <TableCell className="px-6 py-4 text-right">
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
              href="/admin/merchants"
              className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COPY.firstPage}
            </Link>
          ) : null}
          {result.hasNextPage && result.nextCursor ? (
            <Link
              href={`/admin/merchants?${new URLSearchParams({ cursor: result.nextCursor })}`}
              className="inline-flex min-h-12 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COPY.nextButton}
            </Link>
          ) : null}
        </nav>
      ) : null}

      <MerchantPlanDialog merchant={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

interface MerchantPlanDialogProps {
  readonly merchant: AdminMerchantListItem | null;
  readonly onClose: () => void;
}

function MerchantPlanDialog({ merchant, onClose }: MerchantPlanDialogProps) {
  return (
    <Dialog
      open={merchant !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {merchant ? (
        <DialogContent>
          <MerchantPlanForm key={merchant.id} merchant={merchant} onDone={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function MerchantPlanForm({
  merchant,
  onDone,
}: {
  readonly merchant: AdminMerchantListItem;
  readonly onDone: () => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const modeRefs = React.useRef<Record<MerchantPlanMode, HTMLButtonElement | null>>({
    paid: null,
    pilot: null,
  });

  const form = useForm<MerchantPlanFormInput>({
    resolver: zodResolver(merchantPlanFormSchema),
    defaultValues: {
      mode: merchant.subscriptionStatus === 'pilot' ? 'pilot' : 'paid',
      paidUntil: merchant.paidUntil ?? '',
    },
  });
  const mode = form.watch('mode');

  function selectMode(next: MerchantPlanMode) {
    form.setValue('mode', next, { shouldDirty: true });
  }

  function handleModeKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next: MerchantPlanMode = mode === 'paid' ? 'pilot' : 'paid';
    selectMode(next);
    modeRefs.current[next]?.focus();
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const res = await setMerchantSubscriptionAction({
        merchantId: merchant.id,
        subscriptionStatus: MODE_STATUS[data.mode],
        paidUntil: data.paidUntil,
      });
      if (!res.ok) {
        const message = getDomainErrorMessage(res.code);
        setServerError(message);
        notify.error(message);
        return;
      }
      notify.success(COPY.success);
      onDone();
      router.refresh();
    } catch {
      setServerError(COPY.connectionError);
      notify.error(COPY.connectionError);
    }
  });

  const { errors, isSubmitting } = form.formState;
  const dateInputId = `merchant-plan-date-${merchant.id}`;
  const modeLabelId = `merchant-plan-mode-${merchant.id}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{COPY.dialog.title(merchant.businessName)}</DialogTitle>
        <DialogDescription>{COPY.dialog.description}</DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <div className="space-y-2">
          <p id={modeLabelId} className="text-sm font-semibold text-foreground">
            {COPY.dialog.modeLabel}
          </p>
          <div role="radiogroup" aria-labelledby={modeLabelId} className="grid grid-cols-2 gap-3">
            {MERCHANT_PLAN_MODES.map((option) => {
              const checked = mode === option;
              const helpId = `merchant-plan-mode-${option}-help-${merchant.id}`;
              return (
                <div key={option} className="space-y-1.5">
                  <Button
                    ref={(node) => {
                      modeRefs.current[option] = node;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-describedby={helpId}
                    tabIndex={checked ? 0 : -1}
                    variant={checked ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                    onClick={() => selectMode(option)}
                    onKeyDown={handleModeKeyDown}
                  >
                    {COPY.dialog.modes[option]}
                  </Button>
                  <p id={helpId} className="text-sm text-muted-foreground">
                    {COPY.dialog.modeHelp[option]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor={dateInputId} className="block text-sm font-semibold text-foreground">
            {COPY.dialog.dateLabel[mode]}
          </label>
          <Input
            id={dateInputId}
            type="date"
            aria-invalid={Boolean(errors.paidUntil)}
            {...form.register('paidUntil')}
          />
          {errors.paidUntil ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {errors.paidUntil.message}
            </p>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">{COPY.dialog.paymentNote}</p>

        {serverError ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {serverError}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
            {COPY.dialog.cancel}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? COPY.dialog.saving : COPY.dialog.save}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
