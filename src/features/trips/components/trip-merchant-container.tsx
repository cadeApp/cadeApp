'use client';

import React, { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { TripDetails } from '../types';
import { TripMerchantView } from './trip-merchant-view';
import type { TripCancelDialogProps } from './trip-cancel-dialog';
import type { TripReplaceCourierDialogProps } from './trip-replace-courier-dialog';

const TripCancelDialog = dynamic<TripCancelDialogProps>(
  () => import('./trip-cancel-dialog').then((mod) => mod.TripCancelDialog),
  { ssr: false }
);
const TripReplaceCourierDialog = dynamic<TripReplaceCourierDialogProps>(
  () => import('./trip-replace-courier-dialog').then((mod) => mod.TripReplaceCourierDialog),
  { ssr: false }
);
import {
  merchantReportNoShowAction,
  merchantCancelTripAction,
  republishTripAction,
} from '../actions';
import { notify } from '@/ui/notify';
import { getDomainErrorMessage } from '@/lib/error-messages';

export interface TripMerchantContainerProps {
  trip: TripDetails;
}

export function TripMerchantContainer({ trip }: TripMerchantContainerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [replaceCreditsExhausted, setReplaceCreditsExhausted] = useState(false);

  const handleReportNoShow = () => {
    startTransition(async () => {
      setReplaceError(null);
      setReplaceCreditsExhausted(false);
      let res: Awaited<ReturnType<typeof merchantReportNoShowAction>>;
      try {
        res = await merchantReportNoShowAction({
          requestId: trip.id,
          republish: true,
        });
      } catch {
        // PR402-H02: una falla de transporte no cierra el diálogo ni republica; el reintento queda a cargo del comercio.
        if (replaceOpen) setReplaceError(getDomainErrorMessage('INTERNAL_ERROR'));
        notify.error('No se pudo reportar al repartidor.');
        return;
      }

      if (res.ok) {
        notify.success('El repartidor fue reportado. Solicitud republicada para recibir nuevas ofertas.');
        setReplaceOpen(false);
        router.push(`/merchant/requests/${trip.id}`);
      } else {
        // Desde el diálogo D-C2b el error queda visible en él (role="alert"); el toast no es la única señal.
        if (replaceOpen) setReplaceError(getDomainErrorMessage(res.code));
        notify.error('No se pudo reportar al repartidor.');
      }
    });
  };

  const handleReplaceOpenChange = (open: boolean) => {
    setReplaceOpen(open);
    if (!open) {
      setReplaceError(null);
      setReplaceCreditsExhausted(false);
    }
  };

  // D-C2a: republicar desde `matched` deja firme el consumo anterior y reserva otro crédito (lo decide la RPC).
  const handleConfirmReplace = () => {
    startTransition(async () => {
      setReplaceError(null);
      setReplaceCreditsExhausted(false);
      const res = await republishTripAction({ requestId: trip.id, reason: null });

      if (res.ok) {
        notify.success('Sacaste al repartidor. Solicitud republicada para recibir nuevas ofertas.');
        setReplaceOpen(false);
        router.push(`/merchant/requests/${trip.id}`);
        return;
      }
      const message = getDomainErrorMessage(res.code);
      setReplaceError(message);
      setReplaceCreditsExhausted(res.code === 'PUBLICATION_CREDITS_EXHAUSTED');
      notify.error(message);
    });
  };

  const handleOpenCancelModal = () => {
    if (trip.status !== 'matched') return;
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = (reason: string) => {
    startTransition(async () => {
      const res = await merchantCancelTripAction({
        requestId: trip.id,
        reason,
      });

      if (res.ok) {
        notify.success('Envío cancelado.');
        setCancelModalOpen(false);
        router.push('/merchant/dashboard');
      } else {
        notify.error('No se pudo cancelar el envío.');
      }
    });
  };

  return (
    <>
      <TripMerchantView
        trip={trip}
        onReportNoShow={handleReportNoShow}
        isReportingNoShow={isPending}
        onCancelTrip={handleOpenCancelModal}
        onReplaceCourier={() => setReplaceOpen(true)}
      />
      <TripReplaceCourierDialog
        open={replaceOpen}
        onOpenChange={handleReplaceOpenChange}
        onConfirmReplace={handleConfirmReplace}
        onReportNoShow={handleReportNoShow}
        isPending={isPending}
        errorMessage={replaceError}
        creditsExhausted={replaceCreditsExhausted}
      />
      <TripCancelDialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        onConfirm={handleConfirmCancel}
        isPending={isPending}
        actor="merchant"
      />
    </>
  );
}
