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
import dynamic from 'next/dynamic';
import { UnderReview } from './under-review';
import { RequestCard } from './request-card';
import type { OfferSheetProps } from './offer-sheet';
import { FeedSkeleton } from './feed-skeleton';
import { useAvailableRequests } from '../hooks/use-available-requests';

const OfferSheet = dynamic<OfferSheetProps>(
  () => import('./offer-sheet').then((mod) => mod.OfferSheet),
  { ssr: false }
);

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
  requests: initialRequests,
  minOfferArs,
  isLoading = false,
}: CourierFeedProps) {
  const [available, setAvailable] = useState<boolean>(initialAvailable);
  const [selectedRequest, setSelectedRequest] = useState<AvailableRequestItem | null>(null);
  const [isOfferSheetOpen, setIsOfferSheetOpen] = useState<boolean>(false);

  const { requests: liveRequests } = useAvailableRequests(initialRequests, {
    enabled: available && courierStatus === 'approved',
  });
  const requests = liveRequests ?? initialRequests;

  // DoD 1: Repartidor en estado pending ve "En revisión" (R03)
  if (courierStatus === 'pending') {
    return <UnderReview />;
  }

  // Estado rechazado
  if (courierStatus === 'rejected') {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center p-4 text-center">
        <Card className="w-full p-6 sm:p-8">
          <div className="bg-danger/10 text-danger mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="mb-2 font-display text-xl font-bold text-foreground">
            No pudimos aprobar tu cuenta
          </h2>
          <p className="text-sm text-muted-foreground">
            Revisá tu documentación o comunicate con el soporte de cadeApp para más detalles.
          </p>
        </Card>
      </div>
    );
  }

  // Estado suspendido
  if (courierStatus === 'suspended') {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center p-4 text-center">
        <Card className="w-full p-6 sm:p-8">
          <div className="bg-warning/10 text-warning mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="mb-2 font-display text-xl font-bold text-foreground">
            Cuenta suspendida temporalmente
          </h2>
          <p className="text-sm text-muted-foreground">
            Tu cuenta de repartidor se encuentra suspendida. Contactá al soporte para resolver la
            situación.
          </p>
        </Card>
      </div>
    );
  }

  const handleOpenOfferSheet = (request: AvailableRequestItem) => {
    setSelectedRequest(request);
    setIsOfferSheetOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      {/* Conmutador de disponibilidad (R04) */}
      <AvailabilitySwitch
        initialAvailable={available}
        onAvailabilityChange={(next) => setAvailable(next)}
      />

      {/* Encabezado de la lista */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {OFFERS_COPY.feedTitle}
          </h1>
          {available && (
            <Badge variant="published" className="flex items-center gap-1 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-dark" />
              </span>
              {OFFERS_COPY.liveBadge}
            </Badge>
          )}
        </div>
        {available && (
          <span className="text-sm font-semibold text-muted-foreground">{requests.length}</span>
        )}
      </div>

      {/* Estado no disponible (R04-no-disponible) */}
      {!available && (
        <Card className="border border-dashed border-border p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Radio className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mb-1 font-display text-base font-bold text-foreground">
            {OFFERS_COPY.unavailableAlertTitle}
          </h3>
          <p className="text-sm text-muted-foreground">{OFFERS_COPY.unavailableAlertDescription}</p>
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
                <RequestCard key={req.id} request={req} onOfferClick={handleOpenOfferSheet} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Bottom Sheet para ofertar (R05) */}
      {(isOfferSheetOpen || selectedRequest !== null) && (
        <OfferSheet
          isOpen={isOfferSheetOpen}
          onClose={() => {
            setIsOfferSheetOpen(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          minOfferArs={minOfferArs}
        />
      )}
    </div>
  );
}
