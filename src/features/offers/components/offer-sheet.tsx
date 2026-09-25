'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/ui/sheet';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Badge } from '@/ui/badge';
import { formatArs } from '@/lib/format';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { OFFERS_COPY } from '../copy';
import type { AvailableRequestItem, SubmitOfferFormInput } from '../schemas';
import { submitOfferAction } from '../actions';

export interface OfferSheetProps {
  isOpen: boolean;
  onClose: () => void;
  request: AvailableRequestItem | null;
  minOfferArs: number;
  onSubmitOffer?: (
    input: SubmitOfferFormInput
  ) => Promise<{ ok: boolean; code?: string; message?: string }>;
}

export function OfferSheet({
  isOpen,
  onClose,
  request,
  minOfferArs,
  onSubmitOffer,
}: OfferSheetProps) {
  const [amountStr, setAmountStr] = useState<string>('1500');
  const [etaMinutes, setEtaMinutes] = useState<number>(15);
  const [message, setMessage] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sincronizar valor por defecto al abrir con nueva solicitud
  React.useEffect(() => {
    if (isOpen) {
      setServerError(null);
      setAmountStr(String(Math.max(minOfferArs, 1500)));
      setEtaMinutes(15);
      setMessage('');
    }
  }, [isOpen, minOfferArs, request?.id]);

  if (!request) {
    return null;
  }

  const chips = [minOfferArs + 200, minOfferArs + 500, minOfferArs + 1000];

  const handleChipClick = (amount: number) => {
    setAmountStr(String(amount));
    setServerError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setServerError(null);
    setIsSubmitting(true);

    const numericAmount = parseInt(amountStr, 10);

    const payload: SubmitOfferFormInput = {
      requestId: request.id,
      amountArs: isNaN(numericAmount) ? 0 : numericAmount,
      etaMinutes,
      message: message.trim() ? message.trim() : null,
    };

    try {
      if (onSubmitOffer) {
        const res = await onSubmitOffer(payload);
        if (!res.ok) {
          const msg =
            res.message ?? (res.code ? getDomainErrorMessage(res.code) : 'Error al enviar oferta');
          setServerError(msg);
          setIsSubmitting(false);
          return;
        }
      } else {
        const result = await submitOfferAction(payload);
        if (!result.ok) {
          setServerError(getDomainErrorMessage(result.code));
          setIsSubmitting(false);
          return;
        }
      }

      const { notify } = await import('@/ui/notify');
      notify.success(OFFERS_COPY.offerSuccess);
      onClose();
    } catch {
      setServerError('Ocurrió un inconveniente inesperado. Intentá nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const packageLabel =
    request.packageType === 'small'
      ? OFFERS_COPY.packageSmall
      : request.packageType === 'medium'
        ? OFFERS_COPY.packageMedium
        : OFFERS_COPY.packageLarge;

  const paymentLabel =
    request.recipientPaymentMethod === 'cash'
      ? OFFERS_COPY.cashPayment
      : OFFERS_COPY.transferPayment;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader className="border-b border-border/50 pb-3">
          <SheetTitle className="text-xl font-bold">{OFFERS_COPY.offerSheetTitle}</SheetTitle>
          <SheetDescription className="text-sm font-semibold text-foreground">
            {request.pickupZoneName} → {request.dropoffZoneName}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
            <span>
              {OFFERS_COPY.approxDistancePrefix} {request.approxDistanceKm} {OFFERS_COPY.kmUnit}
            </span>
            <span>·</span>
            <span>{packageLabel}</span>
            <span>·</span>
            <span>{paymentLabel}</span>
            {request.needsChange && (
              <Badge variant="in_transit" className="text-sm">
                {OFFERS_COPY.changeNeededBadge}
                {request.cashChangeAmount ? ` (${formatArs(request.cashChangeAmount)})` : ''}
              </Badge>
            )}
          </div>
          {request.notes && (
            <p className="pt-1 text-sm italic text-muted-foreground">
              Indicaciones: {request.notes}
            </p>
          )}
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Monto de la oferta */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="amount-input" className="text-sm font-bold text-foreground">
                {OFFERS_COPY.amountLabel}
              </label>
              <span className="text-sm font-medium text-muted-foreground">
                {OFFERS_COPY.floorPrefix} {formatArs(minOfferArs)}
              </span>
            </div>
            <div className="relative flex items-center">
              <span
                className="pointer-events-none absolute left-3 font-display text-lg font-bold text-muted-foreground"
                aria-hidden="true"
              >
                $
              </span>
              <Input
                id="amount-input"
                aria-label={OFFERS_COPY.amountLabel}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value.replace(/\D/g, ''));
                  setServerError(null);
                }}
                className={`min-h-12 pl-8 font-display text-lg font-bold ${
                  serverError ? 'border-danger focus-visible:ring-danger' : ''
                }`}
                placeholder={OFFERS_COPY.amountPlaceholder}
              />
            </div>

            {/* Error del servidor al ofertar bajo el piso */}
            {serverError && (
              <p role="alert" className="text-danger mt-1.5 text-sm font-semibold transition-all">
                {serverError}
              </p>
            )}

            {/* Chips rápidos */}
            <div className="mt-2.5 flex items-center gap-2">
              {chips.map((chipAmount) => (
                <button
                  key={chipAmount}
                  type="button"
                  onClick={() => handleChipClick(chipAmount)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {formatArs(chipAmount)}
                </button>
              ))}
            </div>
          </div>

          {/* Tiempo estimado de llegada */}
          <div>
            <label htmlFor="eta-select" className="mb-1.5 block text-sm font-bold text-foreground">
              {OFFERS_COPY.etaLabel}
            </label>
            <select
              id="eta-select"
              aria-label={OFFERS_COPY.etaLabel}
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(Number(e.target.value))}
              className="min-h-12 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 hora</option>
            </select>
          </div>

          {/* Mensaje opcional */}
          <div>
            <label
              htmlFor="message-input"
              className="mb-1.5 block text-sm font-bold text-foreground"
            >
              {OFFERS_COPY.messageLabel}
            </label>
            <Textarea
              id="message-input"
              aria-label={OFFERS_COPY.messageLabel}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={OFFERS_COPY.messagePlaceholder}
              maxLength={280}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Nota de privacidad D3/D15 */}
          <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
            {OFFERS_COPY.privacyNotice}
          </p>

          <SheetFooter className="mt-4 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 w-full text-sm font-bold"
            >
              {isSubmitting ? OFFERS_COPY.submittingOffer : OFFERS_COPY.submitOfferButton}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-12 w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {OFFERS_COPY.cancelButton}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
