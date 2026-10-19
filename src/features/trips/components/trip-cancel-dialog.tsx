'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/alert-dialog';
import { Button } from '@/ui/button';
import { Textarea } from '@/ui/textarea';
import { AlertTriangle } from 'lucide-react';

export type TripCancelActor = 'merchant' | 'courier';

export const MERCHANT_CANCELLATION_REASONS = [
  'Ya no hace falta',
  'Lo resolví de otra forma',
  'Me equivoqué en los datos',
  'Otro',
] as const;

export const COURIER_CANCELLATION_REASONS = [
  'Tuve un imprevisto',
  'Problema con el vehículo',
  'No puedo llegar al punto de retiro',
  'Emergencia',
  'Otro',
] as const;

export const CANCELLATION_REASONS = MERCHANT_CANCELLATION_REASONS;

export interface TripCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
  defaultStep?: 1 | 2;
  selectedReason?: string;
  actor?: TripCancelActor;
}

export function TripCancelDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  defaultStep = 1,
  selectedReason: initialReason = '',
  actor = 'merchant',
}: TripCancelDialogProps) {
  const [step, setStep] = useState<1 | 2>(defaultStep);
  const [selectedOption, setSelectedOption] = useState(() => {
    if (!initialReason) return '';
    const reasons = actor === 'courier' ? COURIER_CANCELLATION_REASONS : MERCHANT_CANCELLATION_REASONS;
    return (reasons as readonly string[]).includes(initialReason) ? initialReason : 'Otro';
  });
  const [otherReason, setOtherReason] = useState(() => {
    if (!initialReason) return '';
    const reasons = actor === 'courier' ? COURIER_CANCELLATION_REASONS : MERCHANT_CANCELLATION_REASONS;
    return (reasons as readonly string[]).includes(initialReason) ? '' : initialReason;
  });

  const reasons = actor === 'courier' ? COURIER_CANCELLATION_REASONS : MERCHANT_CANCELLATION_REASONS;

  const isOther = selectedOption === 'Otro';
  const isReasonValid = isOther
    ? otherReason.trim().length > 0 && otherReason.trim().length <= 500
    : selectedOption.trim().length > 0;

  const effectiveReason = isOther ? otherReason.trim() : selectedOption;

  const resetAndClose = () => {
    if (isPending) return;
    setStep(1);
    setSelectedOption('');
    setOtherReason('');
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    resetAndClose();
  };

  const handleConfirm = () => {
    if (isReasonValid && !isPending) {
      onConfirm(effectiveReason);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <div className="mb-1 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Cancelación de viaje</span>
          </div>
          <AlertDialogTitle>
            {step === 1
              ? '¿Por qué cancelás este viaje?'
              : actor === 'courier'
                ? '¿Confirmás que no podés hacer este viaje?'
                : '¿Confirmás la cancelación definitiva?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1
              ? actor === 'courier'
                ? 'Elegí el motivo para liberar la solicitud.'
                : 'Elegí el motivo para informar a la otra parte.'
              : actor === 'courier'
                ? 'La solicitud volverá a publicarse para que otro repartidor pueda tomarla.'
                : 'Las ofertas se van a cerrar. No se puede deshacer.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 1 ? (
          <div className="my-4 space-y-2" role="radiogroup">
            {reasons.map((item) => {
              const isChecked = selectedOption === item;
              return (
                <div key={item} className="space-y-2">
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <input
                      type="radio"
                      name="cancellation-reason"
                      aria-label={item}
                      value={item}
                      checked={isChecked}
                      onChange={() => setSelectedOption(item)}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </label>
                  {item === 'Otro' && isChecked && (
                    <div className="pl-2">
                      <Textarea
                        data-testid="cancellation-other-reason-input"
                        aria-label="Aclaración del motivo"
                        placeholder={
                          actor === 'courier'
                            ? 'Explicá brevemente el motivo...'
                            : 'Explicá el motivo de la cancelación...'
                        }
                        value={otherReason}
                        maxLength={500}
                        onChange={(e) => setOtherReason(e.target.value)}
                        disabled={isPending}
                        className="min-h-[80px] text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="my-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-foreground">
            Motivo seleccionado: <span className="font-semibold">{effectiveReason}</span>
          </div>
        )}

        <AlertDialogFooter>
          {step === 1 ? (
            <>
              <AlertDialogCancel
                type="button"
                className="min-h-[48px]"
              >
                Volver
              </AlertDialogCancel>
              <Button
                type="button"
                disabled={!isReasonValid}
                onClick={() => setStep(2)}
                className="min-h-[48px]"
              >
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setStep(1)}
                className="min-h-[48px]"
              >
                Atrás
              </Button>
              <Button
                type="button"
                variant="destructive"
                isPending={isPending}
                disabled={isPending || !isReasonValid}
                onClick={handleConfirm}
                className="min-h-[48px]"
                aria-busy={isPending ? 'true' : 'false'}
              >
                {isPending ? 'Cancelando...' : 'Sí, cancelar'}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
