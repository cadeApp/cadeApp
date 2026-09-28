'use client';

import * as React from 'react';
import { ArrowLeft, Bell, CheckCircle2, Info, ShieldCheck, Zap } from 'lucide-react';
import { BrandLogo } from '@/ui/brand-logo';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';
import { PUSH_COPY } from '../copy';
import {
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
} from '../subscription';

export interface PushPermissionPromptProps {
  onSuccess?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PushPermissionPrompt({
  onSuccess,
  onDismiss,
  className,
}: PushPermissionPromptProps) {
  const [status, setStatus] = React.useState<
    'idle' | 'requesting' | 'subscribing' | 'granted' | 'denied'
  >('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const current = getNotificationPermission();
    if (current === 'granted') {
      setStatus('granted');
    } else if (current === 'denied') {
      setStatus('denied');
    }
  }, []);

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

    // Gesto explícito de usuario verificado
    const permissionResult = await requestNotificationPermission({ isUserGesture: true });

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
      setErrorMessage(PUSH_COPY.prompt.statusSubscriptionError);
      return;
    }

    // Alta confirmada en backend y browser: marcar éxito y disparar onSuccess
    setStatus('granted');

    if (onSuccess) {
      setTimeout(() => {
        onSuccess();
      }, 700);
    }
  };

  const isPending = status === 'requesting' || status === 'subscribing';

  return (
    <main
      className={cn(
        'relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-between bg-background shadow-xs',
        className
      )}
    >
      {/* TopBar Institucional Marino (bg-foreground text-background según Stitch D16) */}
      <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border/20 bg-foreground px-4 text-background">
        <button
          type="button"
          aria-label={PUSH_COPY.prompt.backAriaLabel}
          onClick={handleDismiss}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-background transition-colors hover:bg-background/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2">
          <BrandLogo variant="inverse" showWordmark={true} size="sm" className="h-7 w-auto" />
        </div>

        <div className="min-w-12" aria-hidden="true" />
      </header>

      {/* Contenido Central */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {/* Campana con indicador visual accesible sin animate-pulse arbitrario */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            {status === 'granted' ? (
              <CheckCircle2 className="h-11 w-11 text-success" aria-hidden="true" />
            ) : (
              <Bell className="h-11 w-11" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Título y Copy Stitch T02 */}
        <div className="mx-auto max-w-[320px] text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {PUSH_COPY.prompt.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {PUSH_COPY.prompt.subtitle}
          </p>
        </div>

        {/* Stack de Beneficios */}
        <div className="mt-6 flex w-full flex-col gap-3">
          <div className="flex items-center gap-3.5 rounded-xl border border-border/40 bg-card p-3.5 shadow-xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                {PUSH_COPY.prompt.benefitSpeedTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {PUSH_COPY.prompt.benefitSpeedDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-border/40 bg-card p-3.5 shadow-xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                {PUSH_COPY.prompt.benefitNoSpamTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {PUSH_COPY.prompt.benefitNoSpamDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Nota informativa no invasiva */}
        <div className="mt-6 flex w-full max-w-[340px] items-center justify-center gap-2 rounded-xl border border-border/30 bg-muted/40 px-3.5 py-3 text-center">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {PUSH_COPY.prompt.fallbackNote}
          </p>
        </div>

        {/* Mensaje de estado dinámico */}
        {status === 'granted' && (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{PUSH_COPY.prompt.statusSuccess}</span>
          </div>
        )}

        {status === 'denied' && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <span>{PUSH_COPY.prompt.statusDenied}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 text-center text-sm text-destructive">
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Acciones ancladas al pie con área táctil >= 48px */}
      <footer className="sticky bottom-0 z-20 flex w-full flex-col gap-2.5 border-t border-border/30 bg-background/95 p-4 backdrop-blur-sm">
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
            {status === 'granted'
              ? PUSH_COPY.prompt.btnActivated
              : PUSH_COPY.prompt.btnActivate}
          </span>
        </Button>

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
    </main>
  );
}
