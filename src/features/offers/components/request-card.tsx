import * as React from 'react';
import { Card, CardContent } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Coins, Package, MapPin, Clock } from 'lucide-react';
import { formatArs } from '@/lib/format';
import { OFFERS_COPY } from '../copy';
import type { AvailableRequestItem } from '../schemas';

export interface RequestCardProps {
  request: AvailableRequestItem;
  onOfferClick: (request: AvailableRequestItem) => void;
}

function calculateRelativeMinutes(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const diffMs = new Date(dateIso).getTime() - Date.now();
  return Math.round(diffMs / 60000);
}

export function RequestCard({ request, onOfferClick }: RequestCardProps) {
  const packageLabel =
    request.packageType === 'small'
      ? OFFERS_COPY.packageSmall
      : request.packageType === 'medium'
      ? OFFERS_COPY.packageMedium
      : OFFERS_COPY.packageLarge;

  const paymentLabel =
    request.recipientPaymentMethod === 'cash'
      ? OFFERS_COPY.cashPayment
      : OFFERS_COPY.transferPayment;

  const minutesPublishedAgo = Math.max(
    1,
    Math.round((Date.now() - new Date(request.publishedAt).getTime()) / 60000)
  );

  const minutesUntilExpiration = calculateRelativeMinutes(request.expiresAt);

  return (
    <Card
      data-testid="request-card"
      className="p-4 shadow-sm border border-border hover:border-primary/40 transition-colors"
    >
      <CardContent className="p-0 space-y-3">
        {/* Recorrido entre barrios (piso 14px -> text-base/text-sm) */}
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
          <h4 className="font-display text-base font-bold text-foreground">
            {request.pickupZoneName} → {request.dropoffZoneName}
          </h4>
        </div>

        {/* Detalle de distancia y paquete (piso 14px -> text-sm) */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {OFFERS_COPY.approxDistancePrefix} {request.approxDistanceKm} {OFFERS_COPY.kmUnit}
          </span>
          <span>·</span>
          <div className="flex items-center gap-1">
            <Package className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{packageLabel}</span>
          </div>
        </div>

        {/* Medio de pago y necesidad de cambio (piso 14px -> text-sm) */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span className="font-medium">{paymentLabel}</span>
          </div>

          {request.needsChange && (
            <Badge variant="in_transit" className="text-sm font-semibold">
              {OFFERS_COPY.changeNeededBadge}
              {request.cashChangeAmount ? ` (${formatArs(request.cashChangeAmount)})` : ''}
            </Badge>
          )}
        </div>

        {/* Indicaciones si hay */}
        {request.notes && (
          <p className="text-sm text-muted-foreground italic">
            Indicaciones: {request.notes}
          </p>
        )}

        {/* Tiempos de publicación y vencimiento (piso 14px -> text-sm) */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground pt-1">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Publicada hace {minutesPublishedAgo} min</span>
          {minutesUntilExpiration && minutesUntilExpiration > 0 && (
            <span>· vence en {minutesUntilExpiration} min</span>
          )}
        </div>

        {/* Botón Ofertar (48px target) o indicador de ya ofertaste */}
        <div className="pt-2">
          {request.hasMyOffer && request.myOfferAmountArs ? (
            <div className="flex min-h-12 w-full items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary-dark">
              {OFFERS_COPY.alreadyOfferedPrefix} {formatArs(request.myOfferAmountArs)}
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOfferClick(request)}
              className="w-full min-h-12 text-sm font-bold"
            >
              {OFFERS_COPY.offerButton}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
