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
import { AlertTriangle } from 'lucide-react';

export const CANCELLATION_REASONS = [
  'Ya no hace falta',
  'Lo resolví de otra forma',
  'Me equivoqué en los datos',
  'Otro',
] as const;

export interface TripCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
  defaultStep?: 1 | 2;
  selectedReason?: string;
}

export function TripCancelDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  defaultStep = 1,
  selectedReason: initialReason = '',
}: TripCancelDialogProps) {
  const [step, setStep] = useState<1 | 2>(defaultStep);
  const [reason, setReason] = useState(initialReason);

  const isReasonValid = reason.trim().length > 0;

  const resetAndClose = () => {
    if (isPending) return;
    setStep(1);
    setReason('');
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
      onConfirm(reason);
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
            {step === 1 ? '¿Por qué cancelás este viaje?' : '¿Confirmás la cancelación definitiva?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1
              ? 'Elegí el motivo para informar a la otra parte.'
              : 'Las ofertas se van a cerrar. No se puede deshacer.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 1 ? (
          <div className="my-4 space-y-2" role="radiogroup">
            {CANCELLATION_REASONS.map((item) => (
              <label
                key={item}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <input
                  type="radio"
                  name="cancellation-reason"
                  aria-label={item}
                  value={item}
                  checked={reason === item}
                  onChange={() => setReason(item)}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm font-medium text-foreground">{item}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="my-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-foreground">
            Motivo seleccionado: <span className="font-semibold">{reason}</span>
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
