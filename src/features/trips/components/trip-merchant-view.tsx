'use client';

import React from 'react';
import type { TripDetails } from '../types';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Badge } from '@/ui/badge';
import {
  buildNotifyCustomerWhatsAppMessage,
  buildTripCoordinationWhatsAppMessage,
  buildWhatsAppUrl,
} from '@/lib/whatsapp';
import { formatArs } from '@/lib/format';
import { formatVehicleType } from '../format';
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react';

export interface TripMerchantViewProps {
  trip: TripDetails;
  onReportNoShow?: () => void;
  isReportingNoShow?: boolean;
  onCancelTrip?: () => void;
}

export function TripMerchantView({
  trip,
  onReportNoShow,
  isReportingNoShow = false,
  onCancelTrip,
}: TripMerchantViewProps) {
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

  const courierWaUrl = trip.courierPhone
    ? buildWhatsAppUrl(trip.courierPhone, coordinationMessage)
    : null;

  const customerMsg = buildNotifyCustomerWhatsAppMessage({
    amountArs: trip.amountArs,
    courierName: trip.courierName,
    recipientPaymentMethod: trip.recipientPaymentMethod,
    needsChange: trip.needsChange,
    cashChangeAmount: trip.cashChangeAmount,
  });

  const customerWaUrl = buildWhatsAppUrl(trip.recipientPhone, customerMsg);

  return (
    <div className="mx-auto max-w-[390px] space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
            {trip.code}
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">Viaje en curso</h1>
        </div>
        <Badge variant={isDelivered ? 'secondary' : 'default'} className="rounded-full text-sm font-medium">
          {isDelivered ? 'Entregado' : isInTransit ? 'En camino' : 'Asignado'}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-1 rounded-xl border border-border bg-card p-3 text-sm shadow-card">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>Asignada</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <div className={`flex items-center gap-1.5 font-medium ${isInTransit || isDelivered ? 'text-foreground' : 'text-primary'}`}>
          {isDelivered ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <Clock className="h-4 w-4 animate-pulse text-primary" />
          )}
          <span>Retirado</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <div className={`flex items-center gap-1.5 font-medium ${isDelivered ? 'text-foreground' : 'text-muted-foreground'}`}>
          <CheckCircle2 className={`h-4 w-4 ${isDelivered ? 'text-primary' : 'text-muted'}`} />
          <span>Entregado</span>
        </div>
      </div>

      <Card className="border-border bg-card shadow-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
            <User className="h-4 w-4 text-primary" />
            Repartidor asignado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {trip.avatarUrl ? (
                <div
                  role="img"
                  aria-label={`Foto de ${trip.courierName}`}
                  className="h-12 w-12 shrink-0 rounded-full border border-border bg-muted bg-cover bg-center"
                  style={{ backgroundImage: `url("${trip.avatarUrl}")` }}
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted"
                >
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 space-y-0.5">
                <h3 className="truncate text-base font-bold text-foreground">{trip.courierName}</h3>
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  <Bike className="h-3.5 w-3.5" />
                  <span>{formatVehicleType(trip.vehicleType)}</span>
                  {trip.licensePlate && (
                    <span>
                      · Patente: <strong className="text-foreground">{trip.licensePlate}</strong>
                    </span>
                  )}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-display text-lg font-bold text-foreground">
              {formatArs(trip.amountArs)}
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            {courierWaUrl ? (
              <a
                href={courierWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 text-sm font-medium text-whatsapp-foreground transition-colors hover:bg-whatsapp-hover"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            ) : (
              <Button type="button" variant="whatsapp" disabled className="min-h-[48px] flex-1">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp no disponible
              </Button>
            )}
            {trip.courierPhone && (
              <a
                href={`tel:${trip.courierPhone}`}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Phone className="h-4 w-4" />
                Llamar
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5 shadow-card">
        <CardContent className="space-y-3 p-4">
          <div>
            <h4 className="text-sm font-bold text-foreground">Avisale a tu cliente</h4>
            <p className="text-sm text-muted-foreground">
              Destinatario: <strong className="text-foreground">{trip.recipientName}</strong>
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/80 p-2.5 text-sm italic text-muted-foreground">
            &quot;{customerMsg}&quot;
          </div>
          <a
            href={customerWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 text-sm font-medium text-whatsapp-foreground shadow-sm transition-colors hover:bg-whatsapp-hover"
          >
            <MessageCircle className="h-4 w-4" />
            Avisar a mi cliente
          </a>
        </CardContent>
      </Card>

      {!isDelivered && (
        <div className="space-y-2 pt-2">
          {onReportNoShow && isMatched && (
            <Button
              type="button"
              variant="outline"
              disabled={isReportingNoShow}
              aria-busy={isReportingNoShow ? 'true' : undefined}
              onClick={onReportNoShow}
              className="min-h-[48px] w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {isReportingNoShow ? 'Reportando...' : 'El repartidor no llegó'}
            </Button>
          )}

          {onCancelTrip && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancelTrip}
              className="min-h-[48px] w-full text-muted-foreground hover:text-destructive"
            >
              Cancelar envío
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
