'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { EmptyState } from '@/ui/empty-state';
import type { ConfirmDialogProps } from '@/ui/dialog';

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

export function MyOffersList({ initialOffers }: MyOffersListProps) {
  const router = useRouter();
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
          className={`min-h-10 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
          className={`min-h-10 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
          className={`min-h-10 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
              className="space-y-3 border-2 border-primary/50 bg-primary/5 p-4 shadow-sm"
            >
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
                <Card key={offer.offerId} className="space-y-3 p-4 shadow-sm">
                  <CardContent className="space-y-2.5 p-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
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
                      <span className="font-semibold">Ofertaste {formatArs(offer.amountArs)}</span>
                      <span className="text-muted-foreground">
                        Llegada en {offer.etaMinutes} min
                      </span>
                    </div>

                    {offer.message && (
                      <p className="text-sm italic text-muted-foreground">
                        &quot;{offer.message}&quot;
                      </p>
                    )}

                    {offer.status === 'pending' && (
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setOfferToWithdraw(offer)}
                          className="text-danger hover:bg-danger/10 hover:text-danger border-danger/30 min-h-12 w-full text-sm font-semibold"
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
