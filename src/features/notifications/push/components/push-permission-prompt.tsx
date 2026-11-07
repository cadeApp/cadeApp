'use client';

import * as React from 'react';
import { ArrowLeft, Bell, BellOff, CheckCircle2, Info, Megaphone, ShieldCheck, Zap } from 'lucide-react';
import { setPromotionsOptInAction } from '@/features/announcements';
import { BrandLogo } from '@/ui/brand-logo';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';
import { PUSH_COPY } from '../copy';
import {
  getNotificationPermission,
  getPushSubscriptionStatus,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../subscription';
import type { PushSubscriptionState } from '../types';

/** T-382: un mensaje por causa de falla del alta. */
function subscribeErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'push_service_unavailable':
      return PUSH_COPY.prompt.statusPushServiceUnavailable;
    case 'permission_blocked':
      return PUSH_COPY.prompt.statusPermissionBlocked;
    case 'unauthorized':
      return PUSH_COPY.prompt.statusSessionExpired;
    case 'network_error':
      return PUSH_COPY.prompt.statusNetworkError;
    case 'missing_vapid_key':
    case 'missing_keys':
      return PUSH_COPY.prompt.statusConfigError;
    case 'unsupported':
      return PUSH_COPY.prompt.statusUnsupported;
    case 'subscription_failed':
      return PUSH_COPY.prompt.statusGenericError;
    default:
      return PUSH_COPY.prompt.statusSubscriptionError;
  }
}

export interface PushPermissionPromptProps {
  onSuccess?: () => void;
  onDismiss?: () => void;
  className?: string;
  /** PR120-H15: dentro de un layout que ya pinta su TopBar (p. ej. CourierLayout). */
  embedded?: boolean;
}

export function PushPermissionPrompt({
  onSuccess,
  onDismiss,
  className,
  embedded = false,
}: PushPermissionPromptProps) {
  const [status, setStatus] = React.useState<
    'idle' | 'requesting' | 'subscribing' | 'granted' | 'denied'
  >('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  // T-382: estado real para la cuenta logueada (permiso + suscripción del navegador + servidor).
  const [accountState, setAccountState] = React.useState<PushSubscriptionState | 'checking'>('checking');
  const [deactivating, setDeactivating] = React.useState(false);

  // Solo la consulta más reciente pinta el estado: una respuesta vieja no vuelve a mostrar «activados».
  const stateRequestRef = React.useRef(0);
  const checkAccountState = React.useCallback(async () => {
    const request = ++stateRequestRef.current;
    setAccountState('checking');
    const next = await getPushSubscriptionStatus();
    if (request === stateRequestRef.current) {
      setAccountState(next);
    }
    return next;
  }, []);

  // PR120-H04: permiso `granted` del navegador no equivale a push activado; el estado final
  // `granted` solo llega después de que subscribeToPush() confirme el alta en backend.
  React.useEffect(() => {
    if (getNotificationPermission() === 'denied') {
      setStatus('denied');
    }
    void checkAccountState();
  }, [checkAccountState]);

  /**
   * Baja (o reintento de una baja pendiente). Si falla, se reconcilia con el estado real: con un endpoint pendiente se
   * muestra «baja pendiente» con reintento; si no quedó pendiente, un error recuperable. Nunca «activados» por inercia.
   */
  const handleDeactivate = async () => {
    stateRequestRef.current += 1;
    setDeactivating(true);
    setErrorMessage(null);
    setInfoMessage(null);
    const result = await unsubscribeFromPush();
    if (result.ok) {
      stateRequestRef.current += 1;
      setDeactivating(false);
      setAccountState('inactive');
      setInfoMessage(PUSH_COPY.prompt.statusDeactivated);
      return;
    }
    const reconciled = await checkAccountState();
    setDeactivating(false);
    if (reconciled !== 'pending_unsubscribe') {
      setErrorMessage(PUSH_COPY.prompt.statusDeactivateError);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  };

  const handleActivate = async () => {
    setStatus('requesting');
    setErrorMessage(null);
    setInfoMessage(null);

    // Si el permiso ya está concedido no se vuelve a pedir; se reconcilia directo con backend.
    const alreadyGranted = getNotificationPermission() === 'granted';
    const permissionResult = alreadyGranted
      ? { ok: true as const }
      : await requestNotificationPermission({ isUserGesture: true });

    if (!permissionResult.ok) {
      if (permissionResult.permission === 'denied') {
        setStatus('denied');
      } else {
        setStatus('idle');
        setErrorMessage(
          permissionResult.error === 'unsupported'
            ? PUSH_COPY.prompt.statusUnsupported
            : PUSH_COPY.prompt.statusGenericError
        );
      }
      return;
    }

    // PR120-H04: Permiso concedido en navegador -> proceder a alta confirmada en backend
    setStatus('subscribing');

    const subResult = await subscribeToPush();
    if (!subResult.ok) {
      setStatus('idle');
      setErrorMessage(subscribeErrorMessage(subResult.error));
      return;
    }

    // Alta confirmada en backend y browser: marcar éxito y disparar onSuccess
    setStatus('granted');

    // T-414 (CC-040): aceptar los avisos incluye las novedades. Best-effort: si falla, los avisos quedan activos.
    try {
      await setPromotionsOptInAction(true);
    } catch {
      // Sin aceptación registrada solo no llegan promos por push; el banner del inicio las sigue mostrando.
    }

    setTimeout(() => {
      if (onSuccess) {
        onSuccess();
      } else {
        handleDismiss();
      }
    }, 700);
  };

  const isPending = status === 'requesting' || status === 'subscribing';
  const isActive = accountState === 'active' && status !== 'granted';
  const isPendingUnsubscribe = accountState === 'pending_unsubscribe' && status !== 'granted';

  // Embebido, el layout ya aporta el landmark <main>: no se anida otro.
  const Root = embedded ? 'div' : 'main';

  return (
    <Root
      className={cn(
        'shadow-xs relative mx-auto flex w-full max-w-md flex-col justify-between bg-background',
        embedded ? 'min-h-full' : 'min-h-screen',
        className
      )}
    >
      {/* TopBar Institucional Marino (bg-foreground text-background según Stitch D16) */}
      {!embedded && (
        <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border/20 bg-foreground px-4 text-background">
          <button
            type="button"
            aria-label={PUSH_COPY.prompt.backAriaLabel}
            onClick={handleDismiss}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-background transition-colors hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
          >
            <ArrowLeft className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2">
            <BrandLogo variant="inverse" showWordmark={true} size="sm" className="h-7 w-auto" />
          </div>

          <div className="min-w-12" aria-hidden="true" />
        </header>
      )}

      {/* Contenido Central */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {/* Campana con indicador visual accesible sin animate-pulse arbitrario */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            {status === 'granted' ? (
              <CheckCircle2 className="text-success h-11 w-11" aria-hidden="true" />
            ) : (
              <Bell className="h-11 w-11" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Título y Copy Stitch T02 */}
        <div className="mx-auto max-w-xs text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {PUSH_COPY.prompt.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{PUSH_COPY.prompt.subtitle}</p>
        </div>

        {/* Stack de Beneficios */}
        <div className="mt-6 flex w-full flex-col gap-3">
          <div className="shadow-xs flex items-center gap-3.5 rounded-xl border border-border/40 bg-card p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                {PUSH_COPY.prompt.benefitSpeedTitle}
              </p>
              <p className="text-sm text-muted-foreground">{PUSH_COPY.prompt.benefitSpeedDesc}</p>
            </div>
          </div>

          <div className="shadow-xs flex items-center gap-3.5 rounded-xl border border-border/40 bg-card p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                {PUSH_COPY.prompt.benefitNoSpamTitle}
              </p>
              <p className="text-sm text-muted-foreground">{PUSH_COPY.prompt.benefitNoSpamDesc}</p>
            </div>
          </div>

          <div className="shadow-xs flex items-center gap-3.5 rounded-xl border border-border/40 bg-card p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{PUSH_COPY.prompt.benefitNewsTitle}</p>
              <p className="text-sm text-muted-foreground">{PUSH_COPY.prompt.benefitNewsDesc}</p>
            </div>
          </div>
        </div>

        {/* Nota informativa no invasiva */}
        <div className="mt-6 flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-border/30 bg-muted/40 px-3.5 py-3 text-center">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{PUSH_COPY.prompt.fallbackNote}</p>
        </div>

        {/* Mensaje de estado dinámico */}
        {status === 'granted' && (
          <div className="text-success mt-4 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{PUSH_COPY.prompt.statusSuccess}</span>
          </div>
        )}

        {status === 'denied' && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <span>{PUSH_COPY.prompt.statusDenied}</span>
          </div>
        )}

        {isActive && (
          <div className="text-success mt-4 flex items-center gap-2 text-sm font-semibold" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{PUSH_COPY.prompt.statusActive}</span>
          </div>
        )}

        {isPendingUnsubscribe && (
          <div className="mt-4 text-center text-sm text-muted-foreground" role="status">
            <span>{PUSH_COPY.prompt.statusDeactivatePending}</span>
          </div>
        )}

        {accountState === 'unknown' && status !== 'granted' && (
          <div className="mt-4 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground" role="status">
            <span>{PUSH_COPY.prompt.statusCheckFailed}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void checkAccountState()}>
              {PUSH_COPY.prompt.btnRetry}
            </Button>
          </div>
        )}

        {infoMessage && (
          <div className="mt-4 text-center text-sm text-muted-foreground" role="status">
            <span>{infoMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 text-center text-sm text-destructive" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Acciones ancladas al pie con área táctil >= 48px */}
      <footer className="sticky bottom-0 z-20 flex w-full flex-col gap-2.5 border-t border-border/30 bg-background/95 p-4 backdrop-blur-sm">
        {isPendingUnsubscribe ? (
          <Button
            type="button"
            variant="outline"
            size="default"
            isPending={deactivating}
            pendingText={PUSH_COPY.prompt.btnDeactivating}
            onClick={handleDeactivate}
            className="w-full gap-2 font-display text-base font-bold"
          >
            <BellOff className="h-5 w-5" aria-hidden="true" />
            <span>{PUSH_COPY.prompt.btnRetryDeactivate}</span>
          </Button>
        ) : isActive ? (
          <Button
            type="button"
            variant="outline"
            size="default"
            isPending={deactivating}
            pendingText={PUSH_COPY.prompt.btnDeactivating}
            onClick={handleDeactivate}
            className="w-full gap-2 font-display text-base font-bold"
          >
            <BellOff className="h-5 w-5" aria-hidden="true" />
            <span>{PUSH_COPY.prompt.btnDeactivate}</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="default"
            isPending={isPending}
            pendingText={PUSH_COPY.prompt.btnActivating}
            disabled={status === 'granted'}
            onClick={handleActivate}
            className="w-full gap-2 font-display text-base font-bold"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span>
              {status === 'granted' ? PUSH_COPY.prompt.btnActivated : PUSH_COPY.prompt.btnActivate}
            </span>
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="default"
          onClick={handleDismiss}
          className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {PUSH_COPY.prompt.btnDismiss}
        </Button>
      </footer>
    </Root>
  );
}
