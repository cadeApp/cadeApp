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
import { AlertCircle } from 'lucide-react';

export interface TripDropFailedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dropPosition?: number;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export function TripDropFailedDialog({
  open,
  onOpenChange,
  dropPosition = 1,
  onConfirm,
  isPending = false,
}: TripDropFailedDialogProps) {
  const [reason, setReason] = useState('');

  const isReasonValid = reason.trim().length > 0;

  const resetAndClose = () => {
    if (isPending) return;
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
    if (!isReasonValid || isPending) return;
    onConfirm(reason.trim());
    setReason('');
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-[360px] p-5">
        <AlertDialogHeader className="space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
          <AlertDialogTitle className="text-center text-lg font-bold">
            No se pudo entregar
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-sm text-muted-foreground">
            {`Indicá el motivo por el cual no se pudo completar la entrega ${dropPosition}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-2 space-y-2">
          <Textarea
            data-testid="drop-failed-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: Destinatario no responde, dirección inaccesible..."
            disabled={isPending}
            className="min-h-20"
          />
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="destructive"
            disabled={!isReasonValid || isPending}
            isPending={isPending}
            onClick={handleConfirm}
            className="min-h-[48px] w-full"
            data-testid="confirm-drop-failed-btn"
          >
            Confirmar no entrega
          </Button>
          <AlertDialogCancel disabled={isPending} className="mt-0 min-h-[44px] w-full">
            Volver
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
