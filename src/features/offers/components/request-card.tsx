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
  isOffline?: boolean;
}

function calculateRelativeMinutes(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const diffMs = new Date(dateIso).getTime() - Date.now();
  return Math.round(diffMs / 60000);
}

export function RequestCard({ request, onOfferClick, isOffline = false }: RequestCardProps) {
  const packageLabel = OFFERS_COPY.packageLabels[request.packageType];
  const paymentLabel = OFFERS_COPY.paymentLabels[request.recipientPaymentMethod];

  const minutesPublishedAgo = Math.max(
    1,
    Math.round((Date.now() - new Date(request.publishedAt).getTime()) / 60000)
  );

  const minutesUntilExpiration = calculateRelativeMinutes(request.expiresAt);

  return (
    <Card
      data-testid="request-card"
      data-request-id={request.id}
      className="p-4 shadow-sm border border-border hover:border-primary/40 transition-colors"
    >
      <CardContent className="p-0 space-y-3">
        {/* Recorrido entre barrios (piso 14px -> text-base/text-sm) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
            <h4 className="font-display text-base font-bold text-foreground">
              {request.pickupZoneName} → {request.dropoffZoneName}
            </h4>
          </div>
          {request.dropsCount && request.dropsCount > 1 ? (
            <Badge variant="outline" className="text-sm font-semibold shrink-0">
              {OFFERS_COPY.dropsCountBadge(request.dropsCount)}
            </Badge>
          ) : null}
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
            </Badge>
          )}
        </div>

        {/* Desglose de entregas si tiene múltiples destinos */}
        {request.drops && request.drops.length > 1 ? (
          <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-sm">
            <span className="font-semibold text-foreground">
              Entregas ({request.drops.length}):
            </span>
            <ul className="space-y-1">
              {request.drops.map((drop) => (
                <li
                  key={drop.position}
                  className="flex items-center justify-between text-muted-foreground"
                >
                  <span>
                    {drop.position}. {drop.dropoffZoneName} · {OFFERS_COPY.packageLabels[drop.packageType]}
                  </span>
                  <span className="font-medium text-foreground">
                    {OFFERS_COPY.paymentLabels[drop.recipientPaymentMethod]}
                    {drop.needsChange ? ' (con cambio)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Tiempos de publicación y vencimiento (piso 14px -> text-sm) */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground pt-1">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Publicada hace {minutesPublishedAgo} min</span>
          {minutesUntilExpiration && minutesUntilExpiration > 0 && (
            <span>· vence en {minutesUntilExpiration} min</span>
          )}
        </div>

        {/* Botón Ofertar / Tomar (48px target) o indicador de ya ofertaste */}
        <div className="pt-2">
          {request.hasMyOffer && request.myOfferAmountArs ? (
            <div className="flex min-h-12 w-full items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary-dark">
              {OFFERS_COPY.alreadyOfferedPrefix} {formatArs(request.myOfferAmountArs)}
            </div>
          ) : (
            <Button
              type="button"
              variant={request.fixedPriceArs ? 'default' : 'secondary'}
              onClick={() => onOfferClick(request)}
              disabled={isOffline}
              className="w-full min-h-12 text-sm font-bold"
            >
              {request.fixedPriceArs
                ? request.dropsCount && request.dropsCount > 1
                  ? OFFERS_COPY.takeMultiDropButton(formatArs(request.fixedPriceArs), request.dropsCount)
                  : OFFERS_COPY.takeRequestButton(formatArs(request.fixedPriceArs))
                : OFFERS_COPY.offerButton}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
