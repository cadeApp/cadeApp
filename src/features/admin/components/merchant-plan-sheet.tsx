'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/ui/sheet';
import { Skeleton } from '@/ui/skeleton';
import { formatDate, formatPhone } from '@/lib/format';
import { getDomainErrorMessage } from '@/lib/error-messages';
import type { MerchantSubscriptionStatus } from '@/domain';
import { getMerchantPlanMovementsAction, setMerchantSubscriptionAction } from '../actions';
import { auditActionLabel, auditFieldLabel, describeAuditChange } from '../audit-format';
import { ADMIN_COPY } from '../copy';
import {
  MERCHANT_PLAN_MODES,
  merchantPlanFormSchema,
  type MerchantPlanFormInput,
  type MerchantPlanMode,
} from '../schemas';
import type { AdminMerchantListItem, AuditLogItem } from '../types';
import { buildAuditHref } from './audit-log-table';

const COPY = ADMIN_COPY.merchants;

const MODE_STATUS: Record<MerchantPlanMode, MerchantSubscriptionStatus> = {
  paid: 'active',
  pilot: 'pilot',
};

export interface MerchantPlanSheetProps {
  readonly merchant: AdminMerchantListItem | null;
  readonly onClose: () => void;
}

/**
 * T-405 (A03): panel lateral para marcar un mes pagado o extender el piloto, con el contacto del comercio y sus
 * últimos movimientos de plan leídos de la auditoría.
 */
export function MerchantPlanSheet({ merchant, onClose }: MerchantPlanSheetProps) {
  return (
    <Sheet
      open={merchant !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {merchant ? (
        <SheetContent side="right" className="flex max-h-screen flex-col gap-6 overflow-y-auto">
          <MerchantPlanPanel key={merchant.id} merchant={merchant} onDone={onClose} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function MerchantPlanPanel({
  merchant,
  onDone,
}: {
  readonly merchant: AdminMerchantListItem;
  readonly onDone: () => void;
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{COPY.dialog.title(merchant.businessName)}</SheetTitle>
        <SheetDescription>{COPY.dialog.description}</SheetDescription>
      </SheetHeader>

      <section aria-label={COPY.sheet.contactLabel} className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-sm font-semibold text-foreground">{merchant.businessName}</p>
        <p className="text-sm text-muted-foreground">{merchant.ownerName || COPY.empty}</p>
        <p className="text-sm text-muted-foreground">{merchant.phone ? formatPhone(merchant.phone) : COPY.empty}</p>
      </section>

      <MerchantPlanForm merchant={merchant} onDone={onDone} />

      <MerchantPlanMovements merchantId={merchant.id} />
    </>
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

      <SheetFooter className="sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          {COPY.dialog.cancel}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? COPY.dialog.saving : COPY.dialog.save}
        </Button>
      </SheetFooter>
    </form>
  );
}

type MovementsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly items: readonly AuditLogItem[] };

function MerchantPlanMovements({ merchantId }: { readonly merchantId: string }) {
  const [state, setState] = React.useState<MovementsState>({ status: 'loading' });
  const titleId = `merchant-plan-movements-${merchantId}`;

  React.useEffect(() => {
    let active = true;
    getMerchantPlanMovementsAction({ merchantId })
      .then((res) => {
        if (active) setState(res.ok ? { status: 'ready', items: res.data } : { status: 'error' });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [merchantId]);

  return (
    <section aria-labelledby={titleId} className="space-y-3 border-t border-border pt-4">
      <h3 id={titleId} className="text-sm font-semibold text-foreground">
        {COPY.sheet.movementsTitle}
      </h3>

      {state.status === 'loading' ? (
        <div role="status" aria-label={COPY.sheet.movementsLoading} className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : state.status === 'error' ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {COPY.sheet.movementsError}
        </p>
      ) : state.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{COPY.sheet.movementsEmpty}</p>
      ) : (
        <ol aria-labelledby={titleId} className="space-y-3">
          {state.items.map((item) => (
            <li key={item.id} className="space-y-1 rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold text-foreground">{auditActionLabel(item.action)}</p>
              {item.changes.map((change) => {
                const display = describeAuditChange(item, change);
                return (
                  <p key={change.field} className="text-foreground">
                    <span className="text-muted-foreground">{auditFieldLabel(change.field)}:</span>{' '}
                    {'value' in display ? (
                      display.value
                    ) : (
                      <>
                        {display.before}
                        <span aria-hidden="true"> → </span>
                        <span className="sr-only"> a </span>
                        {display.after}
                      </>
                    )}
                  </p>
                );
              })}
              <p className="text-muted-foreground">
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                {' · '}
                {COPY.sheet.by(item.actorName ?? ADMIN_COPY.audit.system)}
              </p>
            </li>
          ))}
        </ol>
      )}

      <Link
        href={buildAuditHref({ targetId: merchantId, targetType: 'merchant' })}
        className="inline-flex min-h-12 items-center text-sm font-semibold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {COPY.sheet.viewAll}
      </Link>
    </section>
  );
}
