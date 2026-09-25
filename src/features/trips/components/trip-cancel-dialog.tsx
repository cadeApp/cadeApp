'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/dialog';
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
  const [reason, setReason] = useState<string>(initialReason);

  const isReasonValid = Boolean(reason && reason.trim().length > 0);

  const handleNext = () => {
    if (isReasonValid) {
      setStep(2);
    }
  };

  const handleConfirm = () => {
    if (isReasonValid) {
      onConfirm(reason);
    }
  };

  const handleClose = () => {
    if (!isPending) {
      setStep(1);
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent role="alertdialog" preventCloseOnEscape={isPending}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-1">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Cancelación de viaje</span>
          </div>
          <DialogTitle>
            {step === 1 ? '¿Por qué cancelás este viaje?' : '¿Confirmás la cancelación definitiva?'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Elegí el motivo para informar a la otra parte.'
              : 'Las ofertas se van a cerrar. No se puede deshacer.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-2 my-4" role="radiogroup">
            {CANCELLATION_REASONS.map((r) => (
              <label
                key={r}
                className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <input
                  type="radio"
                  name="cancellation-reason"
                  role="radio"
                  aria-label={r}
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium text-foreground">{r}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="my-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-foreground">
            Motivo seleccionado: <span className="font-semibold">{reason}</span>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="min-h-[48px]"
              >
                Volver
              </Button>
              <Button
                type="button"
                disabled={!isReasonValid}
                onClick={handleNext}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
