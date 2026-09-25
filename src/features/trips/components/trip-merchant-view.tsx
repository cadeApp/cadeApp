'use client';

import React from 'react';
import type { TripDetails } from '../types';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { buildWhatsAppUrl, buildNotifyCustomerWhatsAppMessage } from '@/lib/whatsapp';
import { formatArs } from '@/lib/format';
import {
  CheckCircle2,
  Clock,
  Bike,
  Phone,
  MessageCircle,
  AlertTriangle,
  User,
  ArrowRight,
} from 'lucide-react';

export interface TripMerchantViewProps {
  trip: TripDetails;
  onReportNoShow?: () => void;
  onCancelTrip?: () => void;
}

export function TripMerchantView({
  trip,
  onReportNoShow,
  onCancelTrip,
}: TripMerchantViewProps) {
  const isMatched = trip.status === 'matched';
  const isInTransit = trip.status === 'in_transit';
  const isDelivered = trip.status === 'delivered';

  const courierWaUrl = trip.recipientPhone
    ? buildWhatsAppUrl(trip.recipientPhone, `Hola ${trip.courierName ?? ''}, te escribo por el envío ${trip.code}.`)
    : '#';

  const customerMsg = buildNotifyCustomerWhatsAppMessage({
    amountArs: trip.amountArs ?? 0,
    courierName: trip.courierName ?? 'el repartidor',
    recipientPaymentMethod: trip.recipientPaymentMethod,
    needsChange: trip.needsChange,
    cashChangeAmount: trip.cashChangeAmount,
  });

  const customerWaUrl = trip.recipientPhone
    ? buildWhatsAppUrl(trip.recipientPhone, customerMsg)
    : '#';

  return (
    <div className="space-y-4 p-4 max-w-[390px] mx-auto pb-24">
      {/* Header y código */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {trip.code}
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">Viaje en curso</h1>
        </div>
        <Badge variant={isDelivered ? 'secondary' : 'default'} className="rounded-full text-xs font-medium">
          {isDelivered ? 'Entregado' : isInTransit ? 'En camino' : 'Asignado'}
        </Badge>
      </div>

      {/* Stepper C06: Asignada -> Retirado -> Entregado */}
      <div className="flex items-center justify-between gap-1 p-3 bg-card border border-border rounded-xl shadow-card text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span>Asignada</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        <div className={`flex items-center gap-1.5 font-medium ${isInTransit || isDelivered ? 'text-foreground' : 'text-primary'}`}>
          {isDelivered ? (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          ) : (
            <Clock className="w-4 h-4 text-primary animate-pulse" />
          )}
          <span>Retirado</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        <div className={`flex items-center gap-1.5 font-medium ${isDelivered ? 'text-foreground' : 'text-muted-foreground'}`}>
          <CheckCircle2 className={`w-4 h-4 ${isDelivered ? 'text-primary' : 'text-muted'}`} />
          <span>Entregado</span>
        </div>
      </div>

      {/* Tarjeta del cadete C06 */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Repartidor asignado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-bold text-base text-foreground">{trip.courierName ?? 'Repartidor'}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5" />
                <span>{trip.vehicleType === 'motorcycle' ? 'Moto' : 'Bicicleta'}</span>
                {trip.licensePlate && <span>· Patente: <strong className="text-foreground">{trip.licensePlate}</strong></span>}
              </p>
            </div>
            {trip.amountArs && (
              <span className="font-display text-lg font-bold text-foreground">
                {formatArs(trip.amountArs)}
              </span>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <a
              href={courierWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[#25D366] text-white font-medium text-sm hover:bg-[#20ba5a] transition-colors"
              role="link"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            {trip.recipientPhone && (
              <a
                href={`tel:${trip.recipientPhone}`}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl border border-border bg-background text-foreground font-medium text-sm hover:bg-muted transition-colors"
                role="link"
              >
                <Phone className="w-4 h-4" />
                Llamar
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta destacada "Avisale a tu cliente" */}
      <Card className="border-primary/20 bg-primary/5 shadow-card">
        <CardContent className="p-4 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-foreground">Avisale a tu cliente</h4>
            <p className="text-xs text-muted-foreground">
              Destinatario: <strong className="text-foreground">{trip.recipientName ?? 'Cliente'}</strong>
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-background/80 border border-border/50 text-xs text-muted-foreground italic">
            &quot;{customerMsg}&quot;
          </div>
          <a
            href={customerWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
            role="link"
          >
            <MessageCircle className="w-4 h-4" />
            Avisar a mi cliente
          </a>
        </CardContent>
      </Card>

      {/* Acciones de contingencia C06 */}
      {!isDelivered && (
        <div className="space-y-2 pt-2">
          {onReportNoShow && isMatched && (
            <Button
              type="button"
              variant="outline"
              onClick={onReportNoShow}
              className="w-full min-h-[48px] text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              El repartidor no llegó
            </Button>
          )}

          {onCancelTrip && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancelTrip}
              className="w-full min-h-[48px] text-muted-foreground hover:text-destructive"
            >
              Cancelar envío
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
