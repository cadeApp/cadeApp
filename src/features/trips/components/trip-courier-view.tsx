'use client';

import React from 'react';
import type { TripDetails } from '../types';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { formatArs } from '@/lib/format';
import {
  buildTripCoordinationWhatsAppMessage,
  buildWhatsAppUrl,
} from '@/lib/whatsapp';
import { formatRecipientPaymentMethod } from '../format';
import {
  AlertCircle,
  DollarSign,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Store,
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

  const coordinationMessage = buildTripCoordinationWhatsAppMessage({
    requestCode: trip.code,
    pickupZoneName: trip.pickupZoneName,
    dropoffZoneName: trip.dropoffZoneName,
    amountArs: trip.amountArs,
    recipientPaymentMethod: trip.recipientPaymentMethod,
    needsChange: trip.needsChange,
    cashChangeAmount: trip.cashChangeAmount,
  });

  const merchantWaUrl = trip.merchantPhone
    ? buildWhatsAppUrl(trip.merchantPhone, coordinationMessage)
    : null;

  return (
    <div className="mx-auto max-w-[390px] space-y-4 p-4 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
            {trip.code}
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">Viaje en curso</h1>
        </div>
        <Badge variant={isDelivered ? 'secondary' : 'default'} className="rounded-full text-sm font-medium">
          {isDelivered ? 'Entregado' : isInTransit ? 'En camino' : 'Por retirar'}
        </Badge>
      </div>

      <Card className="border-border bg-card shadow-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">{trip.merchantName}</p>
              <p className="text-sm text-muted-foreground">Comercio del envío</p>
            </div>
          </div>
          <div className="flex gap-2">
            {merchantWaUrl ? (
              <a
                href={merchantWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 text-sm font-medium text-whatsapp-foreground transition-colors hover:bg-whatsapp-hover"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp al comercio
              </a>
            ) : (
              <Button type="button" variant="whatsapp" disabled className="min-h-[48px] flex-1">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp no disponible
              </Button>
            )}
            {trip.merchantPhone && (
              <a
                href={`tel:${trip.merchantPhone}`}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Phone className="h-4 w-4" />
                Llamar
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5 shadow-card">
        <CardContent className="space-y-1 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-primary">
              <DollarSign className="h-3.5 w-3.5" />
              Cobrás al entregar
            </span>
            <span className="font-display text-2xl font-bold text-foreground">
              {formatArs(trip.amountArs)}
            </span>
          </div>
          <p className="pt-1 text-sm text-muted-foreground">
            {formatRecipientPaymentMethod(trip.recipientPaymentMethod)}
            {trip.needsChange && trip.cashChangeAmount
              ? ` · necesita cambio de ${formatArs(trip.cashChangeAmount)}`
              : ''}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-card">
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1">
            <span className="flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Retiro en local
            </span>
            <p className="text-sm font-semibold text-foreground">{trip.pickupAddress}</p>
            <p className="text-sm text-muted-foreground">{trip.pickupZoneName}</p>
          </div>

          <div className="space-y-1 border-t border-border/60 pt-3">
            <span className="flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              Entrega en destino
            </span>
            <p className="text-sm font-semibold text-foreground">{trip.dropoffAddress}</p>
            <p className="text-sm text-muted-foreground">{trip.dropoffZoneName}</p>
            {trip.deliveryNotes && (
              <p className="pt-0.5 text-sm italic text-muted-foreground">&quot;{trip.deliveryNotes}&quot;</p>
            )}
            <p className="pt-1 text-sm font-medium text-foreground">Cliente: {trip.recipientName}</p>
          </div>
        </CardContent>
      </Card>

      {!isDelivered && onCancelTrip && (
        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancelTrip}
            className="min-h-[48px] w-full text-muted-foreground hover:text-destructive"
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            No puedo hacer este viaje
          </Button>
        </div>
      )}

      {!isDelivered && (
        <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-[390px] border-t border-border bg-background/95 p-4 backdrop-blur">
          <Button
            type="button"
            size="lg"
            isPending={isAdvancing}
            disabled={isAdvancing || !onAdvanceTrip}
            onClick={onAdvanceTrip}
            className="h-14 min-h-[56px] w-full bg-primary text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
          >
            {isMatched
              ? 'Marcar como retirado'
              : `Confirmar entrega (${formatArs(trip.amountArs)})`}
          </Button>
        </div>
      )}
    </div>
  );
}
