'use client';

import React from 'react';
import type { TripDetails } from '../types';
import { TripRouteMap } from './trip-route-map';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { formatArs } from '@/lib/format';
import {
  buildNotifyCustomerWhatsAppMessage,
  buildTripCoordinationWhatsAppMessage,
  buildWhatsAppUrl,
} from '@/lib/whatsapp';
import { formatRecipientPaymentMethod } from '../format';
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Store,
  XCircle,
} from 'lucide-react';
import { TripDropFailedDialog } from './trip-drop-failed-dialog';

export interface TripCourierViewProps {
  trip: TripDetails;
  onAdvanceTrip?: () => void;
  onCancelTrip?: () => void;
  onMarkDropDelivered?: (dropId: string) => void;
  onMarkDropFailed?: (dropId: string, reason: string) => void;
  isAdvancing?: boolean;
}

export function TripCourierView({
  trip,
  onAdvanceTrip,
  onCancelTrip,
  onMarkDropDelivered,
  onMarkDropFailed,
  isAdvancing = false,
}: TripCourierViewProps) {
  const [failedModalDrop, setFailedModalDrop] = React.useState<{
    id: string;
    position: number;
  } | null>(null);
  const isMatched = trip.status === 'matched';
  const isInTransit = trip.status === 'in_transit';
  const isDelivered = trip.status === 'delivered';
  const totalAmountArs = trip.totalAmountArs ?? trip.amountArs;
  const dropsCount = trip.dropsCount ?? (trip.drops ? trip.drops.length : 1);
  const collectibleAmountArs =
    trip.collectibleAmountArs ??
    (dropsCount > 1
      ? (trip.drops?.filter((d) => d.status === 'delivered').length ?? 0) * trip.amountArs
      : totalAmountArs);

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
        <Badge
          variant={isDelivered ? 'secondary' : 'default'}
          className="rounded-full text-sm font-medium"
        >
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
            <span className="flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-primary-dark">
              <DollarSign className="h-3.5 w-3.5" />
              {isDelivered || trip.status === 'in_transit'
                ? 'Monto del viaje'
                : 'Cobrás al entregar'}
            </span>
            <span className="font-display text-2xl font-bold text-foreground">
              {formatArs(totalAmountArs)}
            </span>
          </div>
          {dropsCount > 1 ? (
            <p className="pt-0.5 text-sm font-medium text-foreground">
              {formatArs(trip.amountArs)} por entrega ({dropsCount} entregas)
              {trip.status !== 'matched' ? ` · A cobrar: ${formatArs(collectibleAmountArs)}` : ''}
            </p>
          ) : (
            <p className="pt-1 text-sm text-muted-foreground">
              {formatRecipientPaymentMethod(trip.recipientPaymentMethod)}
              {trip.needsChange && trip.cashChangeAmount
                ? ` · necesita cambio de ${formatArs(trip.cashChangeAmount)}`
                : ''}
            </p>
          )}
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
        showExternalNavigation={true}
        title="Recorrido en mapa"
        drops={trip.drops}
      />

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

          {(trip.drops && trip.drops.length > 0
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
                  status: (trip.status === 'delivered' ? 'delivered' : 'pending') as
                    'pending' | 'delivered' | 'failed',
                  deliveredAt: trip.deliveredAt,
                  failedReason: null,
                  dropoffLat: trip.dropoffLat,
                  dropoffLng: trip.dropoffLng,
                },
              ]
          ).map((drop, idx, arr) => {
            const statusLabel =
              drop.status === 'delivered'
                ? 'Entregado'
                : drop.status === 'failed'
                  ? 'No entregado'
                  : 'Pendiente';
            const statusVariant =
              drop.status === 'delivered'
                ? 'secondary'
                : drop.status === 'failed'
                  ? 'destructive'
                  : 'outline';

            const dropCustomerMsg = buildNotifyCustomerWhatsAppMessage({
              courierName: trip.courierName,
              sender: 'courier',
              tripStatus: trip.status,
              dropStatus: arr.length > 1 ? drop.status : undefined,
            });

            let dropCustomerWaUrl: string | null = null;
            if (drop.recipientPhone) {
              try {
                dropCustomerWaUrl = buildWhatsAppUrl(drop.recipientPhone, dropCustomerMsg);
              } catch {
                dropCustomerWaUrl = null;
              }
            }

            return (
              <div key={drop.id} className="space-y-1 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    Entrega {arr.length > 1 ? drop.position : 'en destino'}
                  </span>
                  <Badge variant={statusVariant} className="text-sm font-semibold">
                    {statusLabel}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{drop.dropoffAddress}</p>
                <p className="text-sm text-muted-foreground">{drop.dropoffZoneName}</p>
                {drop.deliveryNotes && (
                  <p className="pt-0.5 text-sm italic text-muted-foreground">
                    &quot;{drop.deliveryNotes}&quot;
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-sm font-medium text-foreground">
                    Cliente: {drop.recipientName}
                  </p>
                  {arr.length > 1 && drop.recipientPhone && (
                    <a
                      href={`tel:${drop.recipientPhone}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      Llamar
                    </a>
                  )}
                </div>
                {dropCustomerWaUrl && (
                  <div className="pt-2">
                    <a
                      href={dropCustomerWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-3 text-sm font-medium text-whatsapp-foreground shadow-sm transition-colors hover:bg-whatsapp-hover"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {arr.length > 1 ? `Avisar a ${drop.recipientName}` : 'Avisar a mi cliente'}
                    </a>
                  </div>
                )}
                {arr.length > 1 && (
                  <p className="text-sm text-muted-foreground">
                    Pago: {formatRecipientPaymentMethod(drop.recipientPaymentMethod)}
                    {drop.needsChange && drop.cashChangeAmount
                      ? ` · cambio de ${formatArs(drop.cashChangeAmount)}`
                      : ''}
                  </p>
                )}
                {drop.failedReason && (
                  <p className="text-sm font-semibold text-destructive">
                    Motivo: {drop.failedReason}
                  </p>
                )}

                {isInTransit && arr.length > 1 && drop.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-[44px] flex-1 bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                      disabled={isAdvancing}
                      isPending={isAdvancing}
                      onClick={() => onMarkDropDelivered?.(drop.id)}
                      data-testid={`mark-drop-delivered-${drop.id}`}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Entregada
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={isAdvancing}
                      onClick={() => setFailedModalDrop({ id: drop.id, position: drop.position })}
                      data-testid={`mark-drop-failed-${drop.id}`}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      No se pudo entregar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
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
          {isMatched ? (
            <Button
              type="button"
              size="lg"
              isPending={isAdvancing}
              disabled={isAdvancing || !onAdvanceTrip}
              onClick={onAdvanceTrip}
              className="h-14 min-h-[56px] w-full bg-primary text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
            >
              Marcar como retirado
            </Button>
          ) : dropsCount <= 1 ? (
            <Button
              type="button"
              size="lg"
              isPending={isAdvancing}
              disabled={isAdvancing || !onAdvanceTrip}
              onClick={onAdvanceTrip}
              className="h-14 min-h-[56px] w-full bg-primary text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
            >
              {`Confirmar entrega (${formatArs(totalAmountArs)})`}
            </Button>
          ) : (
            <div className="flex items-center justify-between py-1 text-sm font-semibold text-muted-foreground">
              <span>Total cobrable acumulado:</span>
              <span className="text-base font-bold text-foreground">
                {formatArs(collectibleAmountArs)}
              </span>
            </div>
          )}
        </div>
      )}

      <TripDropFailedDialog
        open={failedModalDrop !== null}
        onOpenChange={(open) => {
          if (!open) setFailedModalDrop(null);
        }}
        dropPosition={failedModalDrop?.position ?? 1}
        onConfirm={(reason) => {
          if (failedModalDrop) {
            onMarkDropFailed?.(failedModalDrop.id, reason);
            setFailedModalDrop(null);
          }
        }}
        isPending={isAdvancing}
      />
    </div>
  );
}
