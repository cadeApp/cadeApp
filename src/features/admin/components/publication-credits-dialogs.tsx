'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { RpcOutput } from '@/domain';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/format';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import { Textarea } from '@/ui/textarea';
import { grantPublicationCreditsAction, registerPlanPeriodAction } from '../actions';
import { ADMIN_COPY } from '../copy';
import {
  PUBLICATION_GRANT_SOURCES,
  grantCreditsFormSchema,
  registerPeriodFormSchema,
  type GrantCreditsFormInput,
  type RegisterPeriodFormInput,
} from '../schemas';
import type { AdminMerchantHeader, PublicationPlanItem } from '../types';

const COPY = ADMIN_COPY.credits;

/**
 * Clave de idempotencia estable por operación: reintentar el mismo payload (p. ej. tras un corte de red) reusa la
 * clave y la RPC responde `idempotent: true` sin duplicar; un payload distinto usa otra clave. Se descarta al cerrar.
 */
function useOperationKey() {
  const ref = React.useRef<{ readonly key: string; readonly payload: string } | null>(null);
  return React.useMemo(
    () => ({
      forPayload(payload: unknown): string {
        const canonical = JSON.stringify(payload);
        if (ref.current?.payload !== canonical) {
          ref.current = { key: crypto.randomUUID(), payload: canonical };
        }
        return ref.current.key;
      },
    }),
    []
  );
}

interface DialogBaseProps {
  readonly merchant: AdminMerchantHeader;
  readonly open: boolean;
  readonly onClose: () => void;
}

function ResultMessage({ messages }: { readonly messages: readonly string[] }) {
  return (
    <div role="status" className="space-y-1 rounded-lg border border-border bg-muted/60 p-3 text-sm text-foreground">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

function ErrorMessage({ message }: { readonly message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  ) : null;
}

// ---------------------------------------------------------------------------
// Acreditar créditos sueltos
// ---------------------------------------------------------------------------

export function GrantCreditsDialog({ merchant, open, onClose }: DialogBaseProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {open ? (
        <DialogContent>
          <GrantCreditsForm merchant={merchant} onClose={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function GrantCreditsForm({ merchant, onClose }: Omit<DialogBaseProps, 'open'>) {
  const router = useRouter();
  const operationKey = useOperationKey();
  const [step, setStep] = React.useState<'form' | 'confirm' | 'done'>('form');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RpcOutput<'admin_grant_publication_credits'> | null>(null);
  const form = useForm<GrantCreditsFormInput>({
    resolver: zodResolver(grantCreditsFormSchema),
    defaultValues: { credits: '', source: 'purchase', note: '' },
  });
  const source = form.watch('source');
  const values = form.getValues();

  const goToConfirm = form.handleSubmit(() => {
    setError(null);
    setStep('confirm');
  });

  async function confirm() {
    const data = form.getValues();
    const payload = {
      merchantId: merchant.id,
      credits: Number(data.credits),
      source: data.source,
      note: data.note.trim() === '' ? null : data.note.trim(),
    };
    setPending(true);
    setError(null);
    try {
      const res = await grantPublicationCreditsAction({ ...payload, operationKey: operationKey.forPayload(payload) });
      if (!res.ok) {
        const message = getDomainErrorMessage(res.code);
        setError(message);
        notify.error(message);
        return;
      }
      setResult(res.data);
      setStep('done');
      notify.success(res.data.idempotent ? COPY.grant.alreadyRegistered : COPY.grant.success);
      router.refresh();
    } catch {
      setError(COPY.connectionError);
      notify.error(COPY.connectionError);
    } finally {
      setPending(false);
    }
  }

  const sourceLabelId = `grant-source-${merchant.id}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{step === 'confirm' ? COPY.grant.confirmTitle : COPY.grant.title}</DialogTitle>
        <DialogDescription>{COPY.grant.description}</DialogDescription>
      </DialogHeader>

      {step === 'form' ? (
        <form onSubmit={goToConfirm} noValidate className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor={`grant-credits-${merchant.id}`} className="block text-sm font-semibold text-foreground">
              {COPY.grant.creditsLabel}
            </label>
            <Input
              id={`grant-credits-${merchant.id}`}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={Boolean(form.formState.errors.credits)}
              {...form.register('credits')}
            />
            <ErrorMessage message={form.formState.errors.credits?.message ?? null} />
          </div>
          <fieldset className="space-y-2">
            <legend id={sourceLabelId} className="text-sm font-semibold text-foreground">
              {COPY.grant.sourceLabel}
            </legend>
            {PUBLICATION_GRANT_SOURCES.map((option) => (
              <label key={option} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="radio"
                  value={option}
                  className="mt-1 h-4 w-4"
                  {...form.register('source')}
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">{COPY.grant.source[option]}</span>
                  <span className="block text-sm text-muted-foreground">{COPY.grant.sourceHelp[option]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <label htmlFor={`grant-note-${merchant.id}`} className="block text-sm font-semibold text-foreground">
              {COPY.grant.noteLabel}
            </label>
            <Textarea id={`grant-note-${merchant.id}`} rows={2} {...form.register('note')} />
            <ErrorMessage message={form.formState.errors.note?.message ?? null} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {COPY.cancel}
            </Button>
            <Button type="submit">{COPY.continue}</Button>
          </DialogFooter>
        </form>
      ) : null}

      {step === 'confirm' ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-foreground">
            {COPY.grant.confirmSummary(Number(values.credits), merchant.businessName, COPY.grant.source[source])}
          </p>
          <ErrorMessage message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setStep('form')}>
              {COPY.previous}
            </Button>
            <Button type="button" disabled={pending} aria-busy={pending ? 'true' : 'false'} onClick={confirm}>
              {pending ? COPY.saving : COPY.confirm}
            </Button>
          </DialogFooter>
        </div>
      ) : null}

      {step === 'done' && result ? (
        <div className="mt-4 space-y-4">
          <ResultMessage
            messages={[
              result.idempotent ? COPY.grant.alreadyRegistered : COPY.grant.success,
              ...(result.launchDiscountPct !== null ? [COPY.launchDiscount(result.launchDiscountPct)] : []),
            ]}
          />
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              {COPY.close}
            </Button>
          </DialogFooter>
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Registrar o renovar plan
// ---------------------------------------------------------------------------

export interface RegisterPeriodDialogProps extends DialogBaseProps {
  readonly plans: readonly PublicationPlanItem[];
}

export function RegisterPeriodDialog({ merchant, plans, open, onClose }: RegisterPeriodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {open ? (
        <DialogContent>
          <RegisterPeriodForm merchant={merchant} plans={plans} onClose={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function RegisterPeriodForm({ merchant, plans, onClose }: Omit<RegisterPeriodDialogProps, 'open'>) {
  const router = useRouter();
  const operationKey = useOperationKey();
  const activePlans = plans.filter((plan) => plan.active);
  const [step, setStep] = React.useState<'form' | 'confirm' | 'done'>('form');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RpcOutput<'admin_register_plan_period'> | null>(null);
  const form = useForm<RegisterPeriodFormInput>({
    resolver: zodResolver(registerPeriodFormSchema),
    defaultValues: { planId: '', isPurchase: true, note: '' },
  });
  const isPurchase = form.watch('isPurchase');
  const selectedPlan = activePlans.find((plan) => plan.id === form.watch('planId'));

  const goToConfirm = form.handleSubmit(() => {
    setError(null);
    setStep('confirm');
  });

  async function confirm() {
    const data = form.getValues();
    const payload = {
      merchantId: merchant.id,
      planId: data.planId,
      isPurchase: data.isPurchase,
      note: data.note.trim() === '' ? null : data.note.trim(),
    };
    setPending(true);
    setError(null);
    try {
      const res = await registerPlanPeriodAction({ ...payload, operationKey: operationKey.forPayload(payload) });
      if (!res.ok) {
        const message = getDomainErrorMessage(res.code);
        setError(message);
        notify.error(message);
        return;
      }
      setResult(res.data);
      setStep('done');
      notify.success(res.data.idempotent ? COPY.register.alreadyRegistered : COPY.register.success);
      router.refresh();
    } catch {
      setError(COPY.connectionError);
      notify.error(COPY.connectionError);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{step === 'confirm' ? COPY.register.confirmTitle : COPY.register.title}</DialogTitle>
        <DialogDescription>{COPY.register.description}</DialogDescription>
      </DialogHeader>

      {step === 'form' ? (
        <form onSubmit={goToConfirm} noValidate className="mt-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">{COPY.register.planLabel}</legend>
            {activePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.register.noActivePlans}</p>
            ) : (
              activePlans.map((plan) => (
                <label key={plan.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                  <input type="radio" value={plan.id} className="h-4 w-4" {...form.register('planId')} />
                  <span className="text-sm font-medium text-foreground">
                    {plan.name} ·{' '}
                    {plan.monthlyCredits === null ? COPY.plansUnlimited : COPY.plansQuota(plan.monthlyCredits)}
                  </span>
                </label>
              ))
            )}
            <ErrorMessage message={form.formState.errors.planId?.message ?? null} />
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">{COPY.register.purchaseLabel}</legend>
            {([true, false] as const).map((option) => (
              <label key={String(option)} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                <input
                  type="radio"
                  name={`register-purchase-${merchant.id}`}
                  checked={isPurchase === option}
                  onChange={() => form.setValue('isPurchase', option)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-foreground">
                  {option ? COPY.register.purchase.yes : COPY.register.purchase.no}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <label htmlFor={`register-note-${merchant.id}`} className="block text-sm font-semibold text-foreground">
              {COPY.register.noteLabel}
            </label>
            <Textarea id={`register-note-${merchant.id}`} rows={2} {...form.register('note')} />
            <ErrorMessage message={form.formState.errors.note?.message ?? null} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {COPY.cancel}
            </Button>
            <Button type="submit" disabled={activePlans.length === 0}>
              {COPY.continue}
            </Button>
          </DialogFooter>
        </form>
      ) : null}

      {step === 'confirm' && selectedPlan ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-foreground">
            {COPY.register.confirmSummary(
              selectedPlan.name,
              merchant.businessName,
              isPurchase ? COPY.register.purchase.yes.toLowerCase() : COPY.register.purchase.no.toLowerCase()
            )}
          </p>
          <ErrorMessage message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setStep('form')}>
              {COPY.previous}
            </Button>
            <Button type="button" disabled={pending} aria-busy={pending ? 'true' : 'false'} onClick={confirm}>
              {pending ? COPY.saving : COPY.confirm}
            </Button>
          </DialogFooter>
        </div>
      ) : null}

      {step === 'done' && result ? (
        <div className="mt-4 space-y-4">
          <ResultMessage
            messages={[
              result.idempotent ? COPY.register.alreadyRegistered : COPY.register.success,
              COPY.register.resultLine(
                formatDate(result.startsAt),
                formatDate(result.endsAt),
                result.streak,
                result.carryoverPct
              ),
              ...(result.launchDiscountPct !== null ? [COPY.launchDiscount(result.launchDiscountPct)] : []),
            ]}
          />
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              {COPY.close}
            </Button>
          </DialogFooter>
        </div>
      ) : null}
    </>
  );
}
