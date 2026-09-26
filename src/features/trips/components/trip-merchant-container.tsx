'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TripDetails } from '../types';
import { TripMerchantView } from './trip-merchant-view';
import { TripCancelDialog } from './trip-cancel-dialog';
import { merchantReportNoShowAction, merchantCancelTripAction } from '../actions';
import { notify } from '@/ui/notify';

export interface TripMerchantContainerProps {
  trip: TripDetails;
}

export function TripMerchantContainer({ trip }: TripMerchantContainerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const handleReportNoShow = () => {
    startTransition(async () => {
      const res = await merchantReportNoShowAction({
        requestId: trip.id,
        republish: true,
      });

      if (res.ok) {
        notify.success('El repartidor fue reportado. Solicitud republicada para recibir nuevas ofertas.');
        router.refresh();
      } else {
        notify.error('No se pudo reportar al repartidor.');
      }
    });
  };

  const handleOpenCancelModal = () => {
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
      />
      <TripCancelDialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        onConfirm={handleConfirmCancel}
        isPending={isPending}
      />
    </>
  );
}
