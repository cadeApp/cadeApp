'use client';

import React from 'react';
import Link from 'next/link';
import type { TripDetails } from '../types';
import { TripRouteMap } from './trip-route-map';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader } from '@/ui/card';
import { Badge } from '@/ui/badge';
import {
  buildNotifyCustomerWhatsAppMessage,
  buildTripCoordinationWhatsAppMessage,
  buildWhatsAppUrl,
} from '@/lib/whatsapp';
import { formatArs } from '@/lib/format';
import { formatVehicleType, formatRecipientPaymentMethod } from '../format';
import { summarizeDropOutcome, type DropOutcomeSummary } from '../drop-outcome';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock,
  MessageCircle,
  Phone,
  User,
  XCircle,
} from 'lucide-react';

export interface TripMerchantViewProps {
  trip: TripDetails;
  onReportNoShow?: () => void;
  isReportingNoShow?: boolean;
  onCancelTrip?: () => void;
  /** D-C2b: abre el diálogo de «sacar al repartidor» (solo con la solicitud asignada). */
  onReplaceCourier?: () => void;
}

type BadgeVariant = 'default' | 'secondary' | 'partial' | 'destructive' | 'delivered' | 'outline';

/** T-393: etiqueta del encabezado según el resultado real de las entregas, no solo el estado de la solicitud. */
function headerBadge(
  status: TripDetails['status'],
  summary: DropOutcomeSummary
): { label: string; variant: BadgeVariant } {
  if (status === 'in_transit') return { label: 'En camino', variant: 'default' };
  if (status !== 'delivered') return { label: 'Asignado', variant: 'default' };
  if (summary.outcome === 'partial') return { label: 'Entrega parcial', variant: 'partial' };
  if (summary.outcome === 'none_delivered') return { label: 'No entregado', variant: 'destructive' };
  return { label: 'Entregado', variant: 'secondary' };
}

const DROP_STATUS_BADGE = {
  delivered: { label: 'Entregada', variant: 'delivered' },
  failed: { label: 'No entregada', variant: 'destructive' },
  pending: { label: 'Pendiente', variant: 'outline' },
} as const satisfies Record<string, { label: string; variant: BadgeVariant }>;

export function TripMerchantView({
  trip,
  onReportNoShow,
  isReportingNoShow = false,
  onCancelTrip,
  onReplaceCourier,
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

  const dropsList =
    trip.drops && trip.drops.length > 0
      ? trip.drops
      : [
          {
            id: trip.id,
            position: 1,
            dropoffZoneName: trip.dropoffZoneName,
            dropoffAddress: trip.dropoffAddress,
            recipientName: trip.recipientName,
            recipientPhone: trip.recipientPhone,
            deliveryNotes: trip.deliveryNotes,
            cashChangeAmount: trip.cashChangeAmount,
            packageType: 'chico' as const,
            recipientPaymentMethod: trip.recipientPaymentMethod,
            needsChange: trip.needsChange,
            approxDistanceM: null,
            status: 'pending' as const,
            deliveredAt: null,
            failedReason: null,
            dropoffLat: trip.dropoffLat,
            dropoffLng: trip.dropoffLng,
          },
        ];

  const singleDrop = dropsList.length === 1 ? dropsList[0] : null;
  const isMultiDrop = dropsList.length > 1;
  const outcome = summarizeDropOutcome(trip.drops, trip.status);
  const badge = headerBadge(trip.status, outcome);
  const deliveredSummary = `${outcome.delivered} de ${outcome.total} entregadas`;

  return (
    <div className="mx-auto max-w-[390px] space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/merchant/dashboard"
          aria-label="Volver al panel"
          className="inline-flex h-12 min-h-12 w-12 min-w-12 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
            {trip.code}
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">
            {isDelivered ? 'Viaje finalizado' : 'Viaje en curso'}
          </h1>
          {isDelivered && isMultiDrop && (
            <p className="text-sm text-muted-foreground">{deliveredSummary}</p>
          )}
        </div>
        <Badge variant={badge.variant} className="rounded-full text-sm font-medium">
          {badge.label}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-1 rounded-xl border border-border bg-card p-3 text-sm shadow-card">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>Asignada</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <div
          className={`flex items-center gap-1.5 font-medium ${isInTransit || isDelivered ? 'text-foreground' : 'text-primary-dark'}`}
        >
          {isDelivered ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <Clock className="h-4 w-4 text-primary" />
          )}
          <span>Retirado</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <div
          className={`flex items-center gap-1.5 font-medium ${isDelivered ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {isDelivered && outcome.outcome === 'none_delivered' ? (
            <>
              <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
              <span>No entregado</span>
            </>
          ) : (
            <>
              <CheckCircle2 className={`h-4 w-4 ${isDelivered ? 'text-primary' : 'text-muted'}`} />
              <span>
                {isDelivered && outcome.outcome === 'partial' ? deliveredSummary : 'Entregado'}
              </span>
            </>
          )}
        </div>
      </div>

      <Card className="border-border bg-card shadow-card">
        <CardHeader className="p-4 pb-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <User className="h-4 w-4 text-primary" />
            Repartidor asignado
          </h2>
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

          {singleDrop && (
            <p className="text-sm text-muted-foreground">
              Medio de pago:{' '}
              <strong className="text-foreground">
                {formatRecipientPaymentMethod(singleDrop.recipientPaymentMethod)}
              </strong>
            </p>
          )}

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

      <TripRouteMap
        pickupAddress={trip.pickupAddress}
        pickupZoneName={trip.pickupZoneName}
        pickupLat={trip.pickupLat}
        pickupLng={trip.pickupLng}
        dropoffAddress={trip.dropoffAddress}
        dropoffZoneName={trip.dropoffZoneName}
        dropoffLat={trip.dropoffLat}
        dropoffLng={trip.dropoffLng}
        routeDistanceM={trip.routeDistanceM}
        showExternalNavigation={false}
        title="Mapa del viaje"
        drops={trip.drops}
      />

      {dropsList.map((drop) => {
        const dropCustomerMsg = buildNotifyCustomerWhatsAppMessage({
          courierName: trip.courierName,
          sender: 'merchant',
          tripStatus: trip.status,
          // PR508-H01: con una sola entrega no realizada, el aviso también usa el estado de esa entrega.
          dropStatus: dropsList.length > 1 || drop.status === 'failed' ? drop.status : undefined,
        });
        const dropBadge = DROP_STATUS_BADGE[drop.status];
        const showDropBadge = isMultiDrop || drop.status === 'failed';
        let dropCustomerWaUrl: string | null = null;
        if (drop.recipientPhone) {
          try {
            dropCustomerWaUrl = buildWhatsAppUrl(drop.recipientPhone, dropCustomerMsg);
          } catch {
            dropCustomerWaUrl = null;
          }
        }

        return (
          <Card key={drop.id} className="border-primary/20 bg-primary/5 shadow-card">
            <CardContent className="space-y-3 p-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-foreground">
                    Avisale a tu cliente{dropsList.length > 1 ? ` (Entrega ${drop.position})` : ''}
                  </h2>
                  {showDropBadge && (
                    <Badge variant={dropBadge.variant} className="shrink-0 rounded-full text-sm">
                      {dropBadge.label}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Destinatario: <strong className="text-foreground">{drop.recipientName}</strong> ·{' '}
                  {drop.dropoffZoneName}
                </p>
                {dropsList.length > 1 && (
                  <p className="text-sm text-muted-foreground">
                    Medio de pago:{' '}
                    <strong className="text-foreground">
                      {formatRecipientPaymentMethod(drop.recipientPaymentMethod)}
                    </strong>
                  </p>
                )}
                {drop.status === 'failed' && drop.failedReason && (
                  <p className="text-sm font-semibold text-destructive">
                    Motivo: {drop.failedReason}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border/50 bg-background/80 p-2.5 text-sm italic text-muted-foreground">
                &quot;{dropCustomerMsg}&quot;
              </div>
              {dropCustomerWaUrl ? (
                <a
                  href={dropCustomerWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={
                    dropsList.length > 1 ? `Avisar a ${drop.recipientName} por WhatsApp` : undefined
                  }
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 text-sm font-medium text-whatsapp-foreground shadow-sm transition-colors hover:bg-whatsapp-hover"
                >
                  <MessageCircle className="h-4 w-4" />
                  {dropsList.length > 1 ? 'Avisar por WhatsApp' : 'Avisar a mi cliente'}
                </a>
              ) : (
                <Button type="button" variant="whatsapp" disabled className="min-h-[48px] w-full">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp no disponible
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

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

          {onReplaceCourier && isMatched && (
            <Button
              type="button"
              variant="outline"
              disabled={isReportingNoShow}
              onClick={onReplaceCourier}
              className="min-h-[48px] w-full"
            >
              Cambiar de repartidor
            </Button>
          )}

          {onCancelTrip && isMatched && (
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
