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
import {
  grantPublicationCreditsAction,
  listPublicationPlansAction,
  registerPlanPeriodAction,
} from '../actions';
import { ADMIN_COPY } from '../copy';
import {
  PUBLICATION_GRANT_SOURCES,
  grantCreditsFormSchema,
  registerPeriodFormSchema,
  type GrantCreditsFormInput,
  type RegisterPeriodFormInput,
} from '../schemas';
import type { AdminMerchantHeader, PublicationPlanItem, PublicationPlansCursor } from '../types';

const COPY = ADMIN_COPY.credits;

const RECOVERY_COPY = {
  uncertain:
    'No pudimos confirmar si se registró. Volvé a confirmar: se reintenta la misma operación y no se duplica.',
  storageUnavailable:
    'Este navegador no deja guardar la operación en curso, así que no la enviamos para no arriesgar un duplicado. Abrí el panel en una ventana común del navegador y revisá el libro antes de reintentar.',
  loadMorePlans: 'Ver más planes',
  loadingMorePlans: 'Cargando planes...',
  loadMoreError: (detail: string) => `No pudimos cargar más planes. ${detail}`,
} as const;

// ---------------------------------------------------------------------------
// PR402-H01: intento pendiente con clave de idempotencia estable
// ---------------------------------------------------------------------------

type PendingOperationKind = 'admin_grant_publication_credits' | 'admin_register_plan_period';
type FingerprintField = string | number | boolean | null;

const PENDING_PREFIX = 'cadeapp.admin.publication-op.v1.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Digest SHA-512 (Web Crypto) del payload canónico: tipo de RPC, comercio y campos en orden fijo. En storage no queda
 * el payload en claro (ni comercio, ni cantidad, ni nota). Solo en el cliente y con Web Crypto (contexto seguro); si
 * no, `null`.
 */
async function fingerprintOf(kind: PendingOperationKind, fields: readonly FingerprintField[]): Promise<string | null> {
  if (typeof window === 'undefined' || !globalThis.crypto?.subtle) return null;
  try {
    const canonical = JSON.stringify([1, kind, ...fields]);
    const digest = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/**
 * Devuelve la clave del intento pendiente con ese payload o crea una y la guarda ANTES de enviar. Así, si la respuesta
 * se pierde y el diálogo se reabre o la página se recarga en la misma pestaña, el reintento usa la misma clave y la
 * RPC responde `idempotent: true`. Si no se puede guardar, `null`: no se envía con una clave que se perdería.
 * No cubre otra pestaña ni otro navegador (sessionStorage es por pestaña).
 */
async function reservePendingOperation(
  kind: PendingOperationKind,
  fields: readonly FingerprintField[]
): Promise<{ readonly storageKey: string; readonly operationKey: string } | null> {
  const fingerprint = await fingerprintOf(kind, fields);
  if (!fingerprint) return null;
  const storageKey = `${PENDING_PREFIX}${fingerprint}`;
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'key' in parsed &&
        typeof parsed.key === 'string' &&
        UUID_PATTERN.test(parsed.key)
      ) {
        return { storageKey, operationKey: parsed.key };
      }
    }
    const operationKey = globalThis.crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, JSON.stringify({ key: operationKey, createdAt: Date.now() }));
    return { storageKey, operationKey };
  } catch {
    return null;
  }
}

/** Resultado definitivo (éxito o rechazo de la RPC): una operación idéntica posterior es una nueva intención. */
function settlePendingOperation(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Sin storage no hay nada que limpiar.
  }
}

/** `INTERNAL_ERROR` o una excepción de red no dicen si la RPC llegó a escribir: el intento sigue pendiente. */
function isUncertainFailure(code: string) {
  return code === 'INTERNAL_ERROR';
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
    const reservation = await reservePendingOperation('admin_grant_publication_credits', [
      payload.merchantId,
      payload.credits,
      payload.source,
      payload.note,
    ]);
    if (!reservation) {
      setPending(false);
      setError(RECOVERY_COPY.storageUnavailable);
      notify.error(RECOVERY_COPY.storageUnavailable);
      return;
    }
    try {
      const res = await grantPublicationCreditsAction({ ...payload, operationKey: reservation.operationKey });
      if (!res.ok) {
        if (!isUncertainFailure(res.code)) settlePendingOperation(reservation.storageKey);
        const message = getDomainErrorMessage(res.code);
        setError(message);
        notify.error(message);
        return;
      }
      settlePendingOperation(reservation.storageKey);
      setResult(res.data);
      setStep('done');
      notify.success(res.data.idempotent ? COPY.grant.alreadyRegistered : COPY.grant.success);
      router.refresh();
    } catch {
      setError(RECOVERY_COPY.uncertain);
      notify.error(RECOVERY_COPY.uncertain);
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
  /** Primera página de planes activos (`admin_list_publication_plans`, `activeOnly`). */
  readonly plans: readonly PublicationPlanItem[];
  /** Cursor para pedir la página siguiente; `null` si no hay más. */
  readonly plansNextCursor: PublicationPlansCursor | null;
}

export function RegisterPeriodDialog({ merchant, plans, plansNextCursor, open, onClose }: RegisterPeriodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {open ? (
        <DialogContent>
          <RegisterPeriodForm merchant={merchant} plans={plans} plansNextCursor={plansNextCursor} onClose={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/** PR402-H03: planes activos ya cargados más los que se piden por cursor con «Ver más planes». */
function useActivePlanPages(initialPlans: readonly PublicationPlanItem[], initialCursor: PublicationPlansCursor | null) {
  const [plans, setPlans] = React.useState(initialPlans);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listPublicationPlansAction({ activeOnly: true, afterSort: cursor.sort, afterId: cursor.id });
      if (!res.ok) {
        setError(RECOVERY_COPY.loadMoreError(getDomainErrorMessage(res.code)));
        return;
      }
      setPlans((current) => {
        const known = new Set(current.map((plan) => plan.id));
        return [...current, ...res.data.items.filter((plan) => !known.has(plan.id))];
      });
      setCursor(res.data.nextCursor);
    } catch {
      setError(RECOVERY_COPY.loadMoreError(getDomainErrorMessage('INTERNAL_ERROR')));
    } finally {
      setLoading(false);
    }
  }

  return { plans, hasMore: cursor !== null, loading, error, loadMore };
}

function RegisterPeriodForm({ merchant, plans, plansNextCursor, onClose }: Omit<RegisterPeriodDialogProps, 'open'>) {
  const router = useRouter();
  const planPages = useActivePlanPages(plans, plansNextCursor);
  const activePlans = planPages.plans.filter((plan) => plan.active);
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
    const reservation = await reservePendingOperation('admin_register_plan_period', [
      payload.merchantId,
      payload.planId,
      payload.isPurchase,
      payload.note,
    ]);
    if (!reservation) {
      setPending(false);
      setError(RECOVERY_COPY.storageUnavailable);
      notify.error(RECOVERY_COPY.storageUnavailable);
      return;
    }
    try {
      const res = await registerPlanPeriodAction({ ...payload, operationKey: reservation.operationKey });
      if (!res.ok) {
        if (!isUncertainFailure(res.code)) settlePendingOperation(reservation.storageKey);
        const message = getDomainErrorMessage(res.code);
        setError(message);
        notify.error(message);
        return;
      }
      settlePendingOperation(reservation.storageKey);
      setResult(res.data);
      setStep('done');
      notify.success(res.data.idempotent ? COPY.register.alreadyRegistered : COPY.register.success);
      router.refresh();
    } catch {
      setError(RECOVERY_COPY.uncertain);
      notify.error(RECOVERY_COPY.uncertain);
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
            {planPages.hasMore ? (
              <Button
                type="button"
                variant="outline"
                disabled={planPages.loading}
                aria-busy={planPages.loading ? 'true' : 'false'}
                onClick={planPages.loadMore}
              >
                {planPages.loading ? RECOVERY_COPY.loadingMorePlans : RECOVERY_COPY.loadMorePlans}
              </Button>
            ) : null}
            <ErrorMessage message={planPages.error} />
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
