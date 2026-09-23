'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { TopBar } from '@/ui/top-bar';
import { Card, CardContent } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { EmptyState } from '@/ui/empty-state';
import { ConfirmDialog } from '@/ui/dialog';
import { notify } from '@/ui/notify';
import { formatArs } from '@/lib/format';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { MapPin, Clock, CheckCircle2, Inbox } from 'lucide-react';
import { OFFERS_COPY } from '../copy';
import type { CourierOfferItem } from '../schemas';
import { withdrawOfferAction } from '../actions';

export interface MyOffersListProps {
  initialOffers: CourierOfferItem[];
}

export function MyOffersList({ initialOffers }: MyOffersListProps) {
  const [offers, setOffers] = useState<CourierOfferItem[]>(initialOffers);
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted' | 'other'>('pending');
  const [offerToWithdraw, setOfferToWithdraw] = useState<CourierOfferItem | null>(null);
  const [isWithdrawing, startWithdrawTransition] = useTransition();

  const pendingOffers = offers.filter((o) => o.status === 'pending');
  const acceptedOffers = offers.filter((o) => o.status === 'accepted');
  const otherOffers = offers.filter((o) => o.status === 'rejected' || o.status === 'withdrawn');

  const handleWithdrawConfirm = () => {
    if (!offerToWithdraw) return;

    const offerId = offerToWithdraw.offerId;
    startWithdrawTransition(async () => {
      const result = await withdrawOfferAction({ offerId });
      if (!result.ok) {
        notify.error(getDomainErrorMessage(result.code));
      } else {
        notify.success(OFFERS_COPY.withdrawSuccess);
        setOffers((prev) =>
          prev.map((o) => (o.offerId === offerId ? { ...o, status: 'withdrawn' } : o))
        );
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
    <div className="max-w-md mx-auto pb-20">
      <TopBar title={OFFERS_COPY.myOffersTitle} />

      <div className="p-4 space-y-4">
        {/* Pestañas de estado (R06) */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`min-h-10 rounded-lg py-1.5 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
            className={`min-h-10 rounded-lg py-1.5 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
            className={`min-h-10 rounded-lg py-1.5 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
          <div className="space-y-3">
            {acceptedOffers.map((offer) => (
              <Card
                key={offer.offerId}
                className="p-4 border-2 border-primary/50 bg-primary/5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="published" className="text-sm font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {OFFERS_COPY.acceptedOfferBadge}
                  </Badge>
                  <span className="font-display text-lg font-bold text-primary-dark">
                    {formatArs(offer.amountArs)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                  <h4 className="font-display text-base font-bold text-foreground">
                    {offer.pickupZoneName} → {offer.dropoffZoneName}
                  </h4>
                </div>

                <Button
                  className="w-full min-h-12 text-sm font-bold"
                  onClick={() => {
                    window.location.href = `/trips/${offer.requestId}`;
                  }}
                >
                  {OFFERS_COPY.goToTripButton}
                </Button>
              </Card>
            ))}
          </div>
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
              <div className="space-y-3">
                {displayedOffers.map((offer) => (
                  <Card key={offer.offerId} className="p-4 shadow-sm space-y-3">
                    <CardContent className="p-0 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                          <h4 className="font-display text-base font-bold text-foreground">
                            {offer.pickupZoneName} → {offer.dropoffZoneName}
                          </h4>
                        </div>
                        <Badge
                          variant={
                            offer.status === 'pending'
                              ? 'outline'
                              : offer.status === 'accepted'
                              ? 'published'
                              : 'secondary'
                          }
                          className="text-sm font-medium"
                        >
                          {offer.status === 'pending'
                            ? 'Pendiente'
                            : offer.status === 'accepted'
                            ? 'Aceptada'
                            : offer.status === 'withdrawn'
                            ? 'Retirada'
                            : 'Rechazada'}
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

                      {offer.message && (
                        <p className="text-sm text-muted-foreground italic">
                          &quot;{offer.message}&quot;
                        </p>
                      )}

                      {offer.status === 'pending' && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOfferToWithdraw(offer)}
                            className="w-full min-h-12 text-sm font-semibold text-danger hover:bg-danger/10 hover:text-danger border-danger/30"
                          >
                            {OFFERS_COPY.withdrawOfferButton}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Diálogo de confirmación para retirar oferta */}
      <ConfirmDialog
        open={offerToWithdraw !== null}
        onOpenChange={(open) => !open && setOfferToWithdraw(null)}
        title={OFFERS_COPY.withdrawConfirmTitle}
        description={OFFERS_COPY.withdrawConfirmDescription}
        confirmLabel={OFFERS_COPY.withdrawConfirmAction}
        cancelLabel={OFFERS_COPY.cancelButton}
        variant="destructive"
        isPending={isWithdrawing}
        onConfirm={handleWithdrawConfirm}
      />
    </div>
  );
}
