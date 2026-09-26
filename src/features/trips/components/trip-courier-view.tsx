'use client';

import React from 'react';
import type { TripDetails } from '../types';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { formatArs } from '@/lib/format';
import { formatRecipientPaymentMethod } from '../format';
import {
  MapPin,
  Navigation,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

export interface TripCourierViewProps {
  trip: TripDetails;
  onAdvanceTrip?: () => void;
  onCancelTrip?: () => void;
  isAdvancing?: boolean;
}

export function TripCourierView({
  trip,
  onAdvanceTrip,
  onCancelTrip,
  isAdvancing = false,
}: TripCourierViewProps) {
  const isMatched = trip.status === 'matched';
  const isInTransit = trip.status === 'in_transit';
  const isDelivered = trip.status === 'delivered';

  return (
    <div className="space-y-4 p-4 max-w-[390px] mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            {trip.code}
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">Viaje en curso</h1>
        </div>
        <Badge variant={isDelivered ? 'secondary' : 'default'} className="rounded-full text-sm font-medium">
          {isDelivered ? 'Entregado' : isInTransit ? 'En camino' : 'Por retirar'}
        </Badge>
      </div>

      {/* Tarjeta de cobro en mano destacada (D14 / R07) */}
      <Card className="border-primary/30 bg-primary/5 shadow-card">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary flex items-center gap-1 uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5" />
              Cobrás al entregar
            </span>
            <span className="font-display text-2xl font-bold text-foreground">
              {trip.amountArs ? formatArs(trip.amountArs) : 'Monto a confirmar'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground pt-1">
            {formatRecipientPaymentMethod(trip.recipientPaymentMethod)}
            {trip.needsChange && trip.cashChangeAmount && ` · necesita cambio de ${formatArs(trip.cashChangeAmount)}`}
          </p>
        </CardContent>
      </Card>

      {/* Direcciones exactas reveladas (D3 / D15) */}
      <Card className="border-border bg-card shadow-card">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              Retiro en local
            </span>
            <p className="text-sm font-semibold text-foreground">{trip.pickupAddress}</p>
            <p className="text-sm text-muted-foreground">{trip.pickupZoneName}</p>
          </div>

          <div className="border-t border-border/60 pt-3 space-y-1">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              Entrega en destino
            </span>
            <p className="text-sm font-semibold text-foreground">{trip.dropoffAddress ?? 'Dirección protegida'}</p>
            <p className="text-sm text-muted-foreground">{trip.dropoffZoneName}</p>
            {trip.deliveryNotes && (
              <p className="text-sm italic text-muted-foreground pt-0.5">&quot;{trip.deliveryNotes}&quot;</p>
            )}
            {trip.recipientName && (
              <p className="text-sm font-medium text-foreground pt-1">Cliente: {trip.recipientName}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contingencia: No puedo hacer este viaje (48px) */}
      {!isDelivered && onCancelTrip && (
        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancelTrip}
            className="w-full min-h-[48px] text-muted-foreground hover:text-destructive"
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            No puedo hacer este viaje
          </Button>
        </div>
      )}

      {/* Botón sticky gigante de 56px para la moto (R07) */}
      {!isDelivered && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-40 max-w-[390px] mx-auto">
          <Button
            type="button"
            size="lg"
            isPending={isAdvancing}
            disabled={isAdvancing || !onAdvanceTrip}
            onClick={onAdvanceTrip}
            className="w-full h-14 min-h-[56px] text-base font-bold shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isMatched
              ? 'Marcar como retirado'
              : `Confirmar entrega${trip.amountArs ? ` (${formatArs(trip.amountArs)})` : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}
