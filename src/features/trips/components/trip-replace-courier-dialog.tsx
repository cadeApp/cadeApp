'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, UserX } from 'lucide-react';
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

export const REPLACE_COURIER_COPY = {
  eyebrow: 'Cambiar de repartidor',
  title: ['¿Sacar al repartidor asignado?', '¿Confirmás que querés sacarlo y republicar?'],
  description: [
    'La solicitud se vuelve a publicar para recibir ofertas nuevas.',
    'El repartidor deja de estar asignado y no se puede deshacer.',
  ],
  creditWarning:
    'Si publicás con créditos, se usa otro crédito y el de esta asignación no se devuelve. Durante el piloto o con un plan ilimitado no tiene costo.',
  noShowTitle: '¿El repartidor no se presentó?',
  noShowDescription: 'Reportalo en lugar de sacarlo: la solicitud se republica sin usar otro crédito.',
  noShowButton: 'Reportar que no se presentó',
  reporting: 'Reportando...',
  back: 'Volver',
  continue: 'Sacar y republicar',
  previous: 'Atrás',
  confirm: 'Sí, sacar y republicar',
  confirming: 'Republicando...',
  viewCredits: 'Ver mis créditos y planes',
  reasonLabel: 'Motivo del cambio de repartidor',
  reasonPlaceholder: 'Contá brevemente por qué lo sacás...',
} as const;

const COPY = REPLACE_COURIER_COPY;

export interface TripReplaceCourierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `republish_request` desde `matched` (D-C2a): consume otro crédito si el comercio publica con créditos. La RPC
   * exige motivo en ese estado (`REASON_REQUIRED`), por eso se pide en la segunda confirmación (T-378).
   */
  onConfirmReplace: (reason: string) => void;
  /** `report_no_show` con republicación: vuelve a reserva el crédito de la solicitud, sin cobro nuevo. */
  onReportNoShow: () => void;
  isPending?: boolean;
  /** Mensaje del último rechazo de la RPC, visible dentro del diálogo. */
  errorMessage?: string | null;
  /** El rechazo fue por falta de créditos: se ofrece consultar Mi plan. */
  creditsExhausted?: boolean;
}

/**
 * D-C2b (CC-029): diálogo de «sacar al repartidor». Avisa del cobro, ofrece «Reportar que no se presentó» cuando la
 * falla es del repartidor y pide una segunda confirmación antes de republicar.
 */
export function TripReplaceCourierDialog({
  open,
  onOpenChange,
  onConfirmReplace,
  onReportNoShow,
  isPending = false,
  errorMessage = null,
  creditsExhausted = false,
}: TripReplaceCourierDialogProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [reason, setReason] = useState('');
  const trimmedReason = reason.trim();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isPending) return;
    if (!nextOpen) {
      setStep(0);
      setReason('');
    }
    onOpenChange(nextOpen);
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
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-bold uppercase tracking-wider">{COPY.eyebrow}</span>
          </div>
          <AlertDialogTitle>{COPY.title[step]}</AlertDialogTitle>
          <AlertDialogDescription>{COPY.description[step]}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 space-y-3">
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-foreground">
            {COPY.creditWarning}
          </p>

          {step === 0 ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserX className="h-4 w-4" aria-hidden="true" />
                {COPY.noShowTitle}
              </p>
              <p className="text-sm text-muted-foreground">{COPY.noShowDescription}</p>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={onReportNoShow}
                className="min-h-[48px] w-full"
              >
                {isPending ? COPY.reporting : COPY.noShowButton}
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="replace-courier-reason" className="text-sm font-semibold text-foreground">
                {COPY.reasonLabel}
              </label>
              <Textarea
                id="replace-courier-reason"
                value={reason}
                maxLength={500}
                required
                aria-required="true"
                placeholder={COPY.reasonPlaceholder}
                onChange={(event) => setReason(event.target.value)}
                disabled={isPending}
                className="min-h-[80px] text-sm"
              />
            </div>
          )}

          {errorMessage ? (
            <div role="alert" className="space-y-1 text-sm font-medium text-destructive">
              <p>{errorMessage}</p>
              {creditsExhausted ? (
                <Link
                  href="/merchant/plan"
                  className="inline-flex min-h-12 items-center font-semibold text-foreground underline underline-offset-4"
                >
                  {COPY.viewCredits}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <AlertDialogFooter>
          {step === 0 ? (
            <>
              <AlertDialogCancel type="button" disabled={isPending} className="min-h-[48px]">
                {COPY.back}
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => setStep(1)}
                className="min-h-[48px]"
              >
                {COPY.continue}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setStep(0)}
                className="min-h-[48px]"
              >
                {COPY.previous}
              </Button>
              <Button
                type="button"
                variant="destructive"
                isPending={isPending}
                disabled={isPending || trimmedReason === ''}
                aria-busy={isPending ? 'true' : 'false'}
                onClick={() => onConfirmReplace(trimmedReason)}
                className="min-h-[48px]"
              >
                {isPending ? COPY.confirming : COPY.confirm}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
