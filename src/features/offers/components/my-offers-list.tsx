'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import type { EmptyStateProps } from '@/ui/empty-state';
import type { ConfirmDialogProps } from '@/ui/dialog';

const EmptyState = dynamic<EmptyStateProps>(
  () => import('@/ui/empty-state').then((mod) => mod.EmptyState),
  { ssr: false }
);

const ConfirmDialog = dynamic<ConfirmDialogProps>(
  () => import('@/ui/dialog').then((mod) => mod.ConfirmDialog),
  { ssr: false }
);
import { formatArs } from '@/lib/format';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { MapPin, Clock, CheckCircle2, Inbox } from 'lucide-react';
import { OFFERS_COPY } from '../copy';
import type { CourierOfferItem } from '../schemas';
import { withdrawOfferAction } from '../actions';

export interface MyOffersListProps {
  initialOffers: CourierOfferItem[];
}

/** T-379: una oferta aceptada solo está en «Aceptadas» mientras su viaje está activo. */
function isActiveTrip(offer: CourierOfferItem): boolean {
  return (
    offer.status === 'accepted' &&
    (offer.requestStatus === 'matched' || offer.requestStatus === 'in_transit')
  );
}

/**
 * Etiqueta de «Otras»: el estado de la oferta; si fue aceptada, el de la solicitud. Solo un viaje entregado conserva
 * el enlace (el repartidor asignado sigue leyendo la solicitud).
 */
function otherOfferState(offer: CourierOfferItem): { label: string; tripHref: string | null } {
  if (offer.status !== 'accepted') {
    return { label: OFFERS_COPY.offerStatusLabel[offer.status], tripHref: null };
  }
  if (offer.requestStatus === 'delivered') {
    return { label: OFFERS_COPY.requestDeliveredLabel, tripHref: `/trips/${offer.requestId}` };
  }
  if (offer.requestStatus === 'cancelled') {
    return { label: OFFERS_COPY.requestCancelledLabel, tripHref: null };
  }
  return { label: OFFERS_COPY.requestUnavailableLabel, tripHref: null };
}

export function MyOffersList({ initialOffers }: MyOffersListProps) {
  const router = useRouter();
  const [offers, setOffers] = useState<CourierOfferItem[]>(initialOffers);
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted' | 'other'>('pending');
  const [offerToWithdraw, setOfferToWithdraw] = useState<CourierOfferItem | null>(null);
  const [isWithdrawing, startWithdrawTransition] = useTransition();

  const pendingOffers = offers.filter((o) => o.status === 'pending');
  const acceptedOffers = offers.filter(isActiveTrip);
  const otherOffers = offers.filter((o) => o.status !== 'pending' && !isActiveTrip(o));

  const handleWithdrawConfirm = () => {
    if (!offerToWithdraw) return;

    const offerId = offerToWithdraw.offerId;
    startWithdrawTransition(async () => {
      const result = await withdrawOfferAction({ offerId });
      if (!result.ok) {
        void import('@/ui/notify')
          .then(({ notify }) => notify.error(getDomainErrorMessage(result.code)))
          .catch(() => {});
      } else {
        setOffers((prev) =>
          prev.map((o) => (o.offerId === offerId ? { ...o, status: 'withdrawn' } : o))
        );
        void import('@/ui/notify')
          .then(({ notify }) => notify.success(OFFERS_COPY.withdrawSuccess))
          .catch(() => {});
      }
      setOfferToWithdraw(null);
    });
  };

  const displayedOffers =
    activeTab === 'pending'
      ? pendingOffers
      : activeTab === 'accepted'
        ? acceptedOffers
        : otherOffers;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {OFFERS_COPY.myOffersTitle}
      </h1>
      {/* Pestañas de estado (R06) */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`min-h-12 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'pending'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {OFFERS_COPY.tabPending} ({pendingOffers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('accepted')}
          className={`min-h-12 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'accepted'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {OFFERS_COPY.tabAccepted} ({acceptedOffers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('other')}
          className={`min-h-12 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'other'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {OFFERS_COPY.tabOther} ({otherOffers.length})
        </button>
      </div>

      {/* Ofertas destacadas aceptadas en la pestaña de aceptadas o al tope */}
      {activeTab === 'accepted' && acceptedOffers.length > 0 && (
        <ul className="space-y-3">
          {acceptedOffers.map((offer) => (
            <li key={offer.offerId}>
              <Card className="space-y-3 border-2 border-primary/50 bg-primary/5 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="published" className="flex items-center gap-1 text-sm font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    {OFFERS_COPY.acceptedOfferBadge}
                  </Badge>
                  <span className="font-display text-lg font-bold text-primary-dark">
                    {formatArs(offer.amountArs)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <h4 className="font-display text-base font-bold text-foreground">
                    {offer.pickupZoneName} → {offer.dropoffZoneName}
                  </h4>
                </div>

                <Button
                  className="min-h-12 w-full text-sm font-bold"
                  onClick={() => {
                    router.push(`/trips/${offer.requestId}`);
                  }}
                >
                  {OFFERS_COPY.goToTripButton}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Lista de ofertas de la pestaña activa */}
      {activeTab !== 'accepted' && (
        <>
          {displayedOffers.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-8 w-8 text-muted-foreground" />}
              title="No tenés ofertas en esta sección"
              description="Cuando ofertes en pedidos disponibles, van a aparecer acá."
            />
          ) : (
            <ul className="space-y-3">
              {displayedOffers.map((offer) => {
                const otherState = offer.status === 'pending' ? null : otherOfferState(offer);
                return (
                  <li key={offer.offerId}>
                    <Card className="space-y-3 p-4 shadow-sm">
                      <CardContent className="space-y-2.5 p-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                            <h4 className="font-display text-base font-bold text-foreground">
                              {offer.pickupZoneName} → {offer.dropoffZoneName}
                            </h4>
                          </div>
                          <Badge
                            variant={offer.status === 'pending' ? 'outline' : 'secondary'}
                            className="text-sm font-medium"
                          >
                            {otherState ? otherState.label : OFFERS_COPY.offerStatusLabel.pending}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-sm text-foreground">
                          <span className="font-semibold">
                            Ofertaste {formatArs(offer.amountArs)}
                          </span>
                          <span className="text-muted-foreground">
                            Llegada en {offer.etaMinutes} min
                          </span>
                        </div>

                        {/* T-388: sin solicitud visible (RLS) no hay distancia que mostrar, ni siquiera «no calculada». */}
                        {offer.requestStatus !== null ? (
                          <p className="text-sm text-muted-foreground">
                            {OFFERS_COPY.approxDistance(offer.approxDistanceKm)}
                          </p>
                        ) : null}

                        {offer.message && (
                          <p className="text-sm italic text-muted-foreground">
                            &quot;{offer.message}&quot;
                          </p>
                        )}

                        {otherState?.tripHref ? (
                          <Link
                            href={otherState.tripHref}
                            className="inline-flex min-h-12 items-center text-sm font-semibold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {OFFERS_COPY.viewTripLink}
                          </Link>
                        ) : null}

                        {offer.status === 'pending' && (
                          <div className="pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setOfferToWithdraw(offer)}
                              className="min-h-12 w-full border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              {OFFERS_COPY.withdrawOfferButton}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* Diálogo de confirmación para retirar oferta */}
      {offerToWithdraw !== null && (
        <ConfirmDialog
          open={true}
          onOpenChange={(open) => !open && setOfferToWithdraw(null)}
          title={OFFERS_COPY.withdrawConfirmTitle}
          description={OFFERS_COPY.withdrawConfirmDescription}
          confirmLabel={OFFERS_COPY.withdrawConfirmAction}
          cancelLabel={OFFERS_COPY.cancelButton}
          variant="destructive"
          isPending={isWithdrawing}
          onConfirm={handleWithdrawConfirm}
        />
      )}
    </div>
  );
}
