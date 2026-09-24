'use client';

import * as React from 'react';
import { useState } from 'react';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { AvailabilitySwitch } from '@/features/availability';
import { Radio, AlertCircle } from 'lucide-react';
import { OFFERS_COPY } from '../copy';
import type { AvailableRequestItem, CourierStatus } from '../schemas';
import { UnderReview } from './under-review';
import { RequestCard } from './request-card';
import { OfferSheet } from './offer-sheet';
import { FeedSkeleton } from './feed-skeleton';

export interface CourierFeedProps {
  courierStatus: CourierStatus;
  isAvailable: boolean;
  requests: AvailableRequestItem[];
  minOfferArs: number;
  isLoading?: boolean;
}

export function CourierFeed({
  courierStatus,
  isAvailable: initialAvailable,
  requests,
  minOfferArs,
  isLoading = false,
}: CourierFeedProps) {
  const [available, setAvailable] = useState<boolean>(initialAvailable);
  const [selectedRequest, setSelectedRequest] = useState<AvailableRequestItem | null>(null);
  const [isOfferSheetOpen, setIsOfferSheetOpen] = useState<boolean>(false);

  // DoD 1: Repartidor en estado pending ve "En revisión" (R03)
  if (courierStatus === 'pending') {
    return <UnderReview />;
  }

  // Estado rechazado
  if (courierStatus === 'rejected') {
    return (
      <div className="p-4 max-w-md mx-auto min-h-[70vh] flex flex-col justify-center items-center text-center">
        <div className="h-16 w-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          No pudimos aprobar tu cuenta
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Revisá tu documentación o comunicate con el soporte de cadeApp para más detalles.
        </p>
      </div>
    );
  }

  // Estado suspendido
  if (courierStatus === 'suspended') {
    return (
      <div className="p-4 max-w-md mx-auto min-h-[70vh] flex flex-col justify-center items-center text-center">
        <div className="h-16 w-16 rounded-full bg-warning/10 text-warning flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          Cuenta suspendida temporalmente
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Tu cuenta de repartidor se encuentra suspendida. Contactá al soporte para resolver la situación.
        </p>
      </div>
    );
  }

  const handleOpenOfferSheet = (request: AvailableRequestItem) => {
    setSelectedRequest(request);
    setIsOfferSheetOpen(true);
  };

  return (
    <div className="space-y-4 p-4">
        {/* Conmutador de disponibilidad (R04) */}
        <AvailabilitySwitch
          initialAvailable={available}
          onAvailabilityChange={(next) => setAvailable(next)}
        />

        {/* Encabezado de la lista */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-foreground">
              {OFFERS_COPY.feedTitle}
            </h2>
            {available && (
              <Badge variant="published" className="text-xs flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-dark" />
                </span>
                {OFFERS_COPY.liveBadge}
              </Badge>
            )}
          </div>
          {available && (
            <span className="text-sm font-semibold text-muted-foreground">
              {requests.length}
            </span>
          )}
        </div>

        {/* Estado no disponible (R04-no-disponible) */}
        {!available && (
          <Card className="p-6 text-center shadow-sm border border-dashed border-border">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <Radio className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-bold text-foreground mb-1">
              {OFFERS_COPY.unavailableAlertTitle}
            </h3>
            <p className="text-sm text-muted-foreground">
              {OFFERS_COPY.unavailableAlertDescription}
            </p>
          </Card>
        )}

        {/* Estado disponible */}
        {available && (
          <>
            {isLoading ? (
              <FeedSkeleton />
            ) : requests.length === 0 ? (
              <EmptyState
                icon={<Radio className="h-8 w-8 text-muted-foreground" />}
                title={OFFERS_COPY.emptyFeedTitle}
                description={OFFERS_COPY.emptyFeedDescription}
              />
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onOfferClick={handleOpenOfferSheet}
                  />
                ))}
              </div>
            )}
          </>
        )}

      {/* Bottom Sheet para ofertar (R05) */}
      <OfferSheet
        isOpen={isOfferSheetOpen}
        onClose={() => {
          setIsOfferSheetOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        minOfferArs={minOfferArs}
      />
    </div>
  );
}
