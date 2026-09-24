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
import { notify } from '@/ui/notify';
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

  const chips = [
    minOfferArs + 200,
    minOfferArs + 500,
    minOfferArs + 1000,
  ];

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
          const msg = res.message ?? (res.code ? getDomainErrorMessage(res.code) : 'Error al enviar oferta');
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
        <SheetHeader className="pb-3 border-b border-border/50">
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
            <p className="text-sm italic text-muted-foreground pt-1">
              Indicaciones: {request.notes}
            </p>
          )}
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Monto de la oferta */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="amount-input" className="text-sm font-bold text-foreground">
                {OFFERS_COPY.amountLabel}
              </label>
              <span className="text-sm font-medium text-muted-foreground">
                {OFFERS_COPY.floorPrefix} {formatArs(minOfferArs)}
              </span>
            </div>
            <div className="relative flex items-center">
              <span
                className="absolute left-3 font-display text-lg font-bold text-muted-foreground pointer-events-none"
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
                className={`pl-8 font-display text-lg font-bold min-h-12 ${
                  serverError ? 'border-danger focus-visible:ring-danger' : ''
                }`}
                placeholder={OFFERS_COPY.amountPlaceholder}
              />
            </div>

            {/* Error del servidor al ofertar bajo el piso */}
            {serverError && (
              <p
                role="alert"
                className="text-sm font-semibold text-danger mt-1.5 transition-all"
              >
                {serverError}
              </p>
            )}

            {/* Chips rápidos */}
            <div className="flex items-center gap-2 mt-2.5">
              {chips.map((chipAmount) => (
                <button
                  key={chipAmount}
                  type="button"
                  onClick={() => handleChipClick(chipAmount)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  {formatArs(chipAmount)}
                </button>
              ))}
            </div>
          </div>

          {/* Tiempo estimado de llegada */}
          <div>
            <label htmlFor="eta-select" className="text-sm font-bold text-foreground block mb-1.5">
              {OFFERS_COPY.etaLabel}
            </label>
            <select
              id="eta-select"
              aria-label={OFFERS_COPY.etaLabel}
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(Number(e.target.value))}
              className="w-full min-h-12 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <label htmlFor="message-input" className="text-sm font-bold text-foreground block mb-1.5">
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
          <p className="text-sm text-muted-foreground leading-relaxed pt-1">
            {OFFERS_COPY.privacyNotice}
          </p>

          <SheetFooter className="mt-4 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-12 text-sm font-bold"
            >
              {isSubmitting ? OFFERS_COPY.submittingOffer : OFFERS_COPY.submitOfferButton}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full min-h-12 text-sm text-muted-foreground hover:text-foreground"
            >
              {OFFERS_COPY.cancelButton}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
