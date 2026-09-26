'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TripDetails } from '../types';
import { TripCourierView } from './trip-courier-view';
import { TripCancelDialog } from './trip-cancel-dialog';
import {
  markTripPickedUpAction,
  markTripDeliveredAction,
  courierCancelTripAction,
} from '../actions';
import { notify } from '@/ui/notify';

export interface TripCourierContainerProps {
  trip: TripDetails;
}

export function TripCourierContainer({ trip }: TripCourierContainerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const handleAdvanceTrip = () => {
    startTransition(async () => {
      if (trip.status === 'matched') {
        const res = await markTripPickedUpAction({ requestId: trip.id });
        if (res.ok) {
          notify.success('Pedido marcado como retirado.');
          router.refresh();
        } else {
          notify.error('No se pudo marcar como retirado.');
        }
      } else if (trip.status === 'in_transit') {
        const res = await markTripDeliveredAction({ requestId: trip.id });
        if (res.ok) {
          notify.success('¡Entrega confirmada!');
          router.refresh();
        } else {
          notify.error('No se pudo confirmar la entrega.');
        }
      }
    });
  };

  const handleOpenCancelModal = () => {
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = (reason: string) => {
    startTransition(async () => {
      const res = await courierCancelTripAction({
        requestId: trip.id,
        reason,
      });

      if (res.ok) {
        notify.success('Viaje cancelado.');
        setCancelModalOpen(false);
        router.push('/courier/feed');
      } else {
        notify.error('No se pudo cancelar el viaje.');
      }
    });
  };

  return (
    <>
      <TripCourierView
        trip={trip}
        onAdvanceTrip={handleAdvanceTrip}
        onCancelTrip={handleOpenCancelModal}
        isAdvancing={isPending}
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
