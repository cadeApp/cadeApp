'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Clock, ShieldCheck, AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { sortOffersForMerchant, type OfferSortOrder } from '@/domain/priority';
import { formatArs } from '@/lib/format';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { notify } from '@/ui/notify';
import { acceptOfferAction } from '@/features/offers';
import { requestsCopy } from '../copy';
import { useRequestOffers } from '../hooks/use-request-offers';
import type { MerchantOfferItem } from '../types';
import type { LivePageCursor } from '@/lib/live-contracts';

export interface RequestOffersListProps {
  request: {
    id: string;
    pickupZoneName: string;
    dropoffZoneName: string;
    approxDistanceKm: string | null;
    packageType: 'sobre' | 'chico' | 'mediano' | 'grande' | string;
    recipientPaymentMethod: 'cash' | 'transfer' | 'to_agree' | string;
    needsChange: boolean;
    cashChangeAmount: number | null;
    status: string;
    expiresAt: string | null;
  };
  initialOffers: readonly MerchantOfferItem[];
  initialNextCursor?: LivePageCursor | null;
  onAcceptSuccess?: (offerId: string) => void;
}

function getVehicleLabel(vehicleType: string | null): string {
  switch (vehicleType) {
    case 'motorcycle':
      return 'Moto';
    case 'bicycle':
      return 'Bicicleta';
    case 'auto':
      return 'Auto';
    default:
      return 'Repartidor';
  }
}

function getPackageLabel(packageType: string): string {
  switch (packageType) {
    case 'sobre':
      return 'Sobre';
    case 'chico':
      return 'Chico';
    case 'mediano':
      return 'Mediano';
    case 'grande':
      return 'Grande';
    default:
      return packageType;
  }
}

export function RequestOffersList({
  request,
  initialOffers,
  initialNextCursor,
  onAcceptSuccess,
}: RequestOffersListProps) {
  const {
    offers,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isError,
    refetch,
  } = useRequestOffers(request.id, initialOffers, initialNextCursor ?? null);
  const [sortOrder, setSortOrder] = useState<OfferSortOrder>('doc_level');
  const [selectedOffer, setSelectedOffer] = useState<MerchantOfferItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Cronómetro de vencimiento sin non-null assertions
  useEffect(() => {
    const expiresAt = request.expiresAt;
    if (!expiresAt) return;
    const targetExpiresAt: string = expiresAt;

    function updateTimer() {
      const expiresTime = new Date(targetExpiresAt).getTime();
      const diffMs = expiresTime - Date.now();

      if (diffMs <= 0) {
        setTimeRemaining('Expirada');
        return;
      }

      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      setTimeRemaining(`${diffMins}m ${diffSecs.toString().padStart(2, '0')}s`);
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [request.expiresAt]);

  const sortedOffers = useMemo(() => {
    return sortOffersForMerchant(offers, sortOrder);
  }, [offers, sortOrder]);

  const handleOpenAcceptModal = (offer: MerchantOfferItem) => {
    setAcceptError(null);
    setSelectedOffer(offer);
  };

  const handleCloseAcceptModal = () => {
    if (isSubmitting) return;
    setSelectedOffer(null);
    setAcceptError(null);
  };

  const handleConfirmAccept = async () => {
    if (!selectedOffer) return;

    setIsSubmitting(true);
    setAcceptError(null);

    try {
      const res = await acceptOfferAction({ offerId: selectedOffer.id });
      if (res.ok) {
        notify.success('¡Oferta aceptada! El repartidor ya va en camino.');
        setSelectedOffer(null);
        onAcceptSuccess?.(selectedOffer.id);
      } else {
        if (res.code === 'ALREADY_MATCHED') {
          setAcceptError(
            'Esta solicitud ya fue asignada a otro repartidor o la oferta no está disponible.'
          );
        } else if (res.code === 'REQUEST_EXPIRED') {
          setAcceptError('La solicitud ha expirado.');
        } else {
          setAcceptError('No se pudo aceptar la oferta. Por favor, intentá nuevamente.');
        }
      }
    } catch {
      setAcceptError('Ocurrió un error inesperado al aceptar la oferta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const courierFirstName = selectedOffer
    ? selectedOffer.courierName.split(' ')[0]
    : 'el repartidor';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col space-y-6">
      {/* Resumen de la solicitud */}
      <Card className="border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span>{request.pickupZoneName}</span>
              <ArrowRight className="h-4 w-4" />
              <span>{request.dropoffZoneName}</span>
              <span>· {request.approxDistanceKm} km</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-foreground">
              <span className="font-semibold">Paquete {getPackageLabel(request.packageType)}</span>
              <span>·</span>
              <span>
                {request.recipientPaymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
              </span>
              {request.needsChange && request.cashChangeAmount && (
                <span className="text-muted-foreground">
                  (Paga con {formatArs(request.cashChangeAmount)})
                </span>
              )}
            </div>
          </div>

          {/* Vencimiento / Cronómetro */}
          {request.expiresAt && (
            <div className="flex items-center gap-2 self-start rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground sm:self-center">
              <Clock className="h-4 w-4" />
              <span>{timeRemaining || 'Calculando...'}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Selector de ordenamiento C04 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Ofertas recibidas</h2>
          <p className="text-sm text-muted-foreground">
            {offers.length === 1
              ? '1 oferta disponible para este envío'
              : `${offers.length} ofertas disponibles para este envío`}
          </p>
        </div>

        {/* Control segmentado Documentación / Precio */}
        <div
          role="group"
          aria-label="Criterio de ordenamiento de ofertas"
          className="inline-flex rounded-lg border border-border bg-muted p-1"
        >
          <button
            type="button"
            aria-pressed={sortOrder === 'doc_level'}
            onClick={() => setSortOrder('doc_level')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              sortOrder === 'doc_level'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Documentación
          </button>
          <button
            type="button"
            aria-pressed={sortOrder === 'price'}
            onClick={() => setSortOrder('price')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              sortOrder === 'price'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Precio
          </button>
        </div>
      </div>

      {/* Estado de error si la sincronización en vivo falla */}
      {isError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                {requestsCopy.offers.errorLoadingOffers}
              </p>
              <p className="text-sm text-muted-foreground">
                {requestsCopy.offers.errorDescription}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="self-end sm:self-center"
          >
            {requestsCopy.offers.retryButton}
          </Button>
        </div>
      )}

      {/* Lista de ofertas o Empty State */}
      {sortedOffers.length === 0 ? (
        !isError && (
          <Card className="flex flex-col items-center justify-center border-dashed border-border bg-card p-8 text-center">
            <div className="mb-3 rounded-xl border border-border bg-muted/40 p-3">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {requestsCopy.offers.waitingOffers}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {requestsCopy.offers.waitingOffersDescription}
            </p>
          </Card>
        )
      ) : (
        <div className="flex flex-col space-y-3">
          {sortedOffers.map((offer) => (
            <Card
              key={offer.id}
              className="flex flex-col justify-between gap-4 border-border bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-bold text-foreground">{offer.courierName}</h4>
                  <span className="text-sm font-medium text-muted-foreground">
                    · {getVehicleLabel(offer.vehicleType)}
                  </span>
                </div>

                {/* Badges de verificación (sin estrellas ni calificaciones según S4) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {offer.licenseStatus === 'verified' && (
                    <Badge variant="verified">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Licencia verificada
                    </Badge>
                  )}
                  {offer.insuranceStatus === 'verified' && (
                    <Badge variant="verified">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Seguro verificado
                    </Badge>
                  )}
                  {offer.docLevel === 0 && (
                    <Badge variant="declared">Documentación en revisión</Badge>
                  )}
                </div>

                {/* Mensaje opcional del repartidor */}
                {offer.message && (
                  <p className="text-sm italic text-muted-foreground">
                    &ldquo;{offer.message}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="text-left sm:text-right">
                  <div className="text-lg font-bold text-foreground">
                    {formatArs(offer.amountArs)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Llega en {offer.etaMinutes} min
                  </div>
                </div>

                <Button
                  type="button"
                  variant="default"
                  onClick={() => handleOpenAcceptModal(offer)}
                >
                  Aceptar
                </Button>
              </div>
            </Card>
          ))}
          {hasNextPage && !isError && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage
                  ? requestsCopy.offers.loadingMore
                  : requestsCopy.offers.loadMore}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal C05: Confirmar aceptación */}
      <Dialog open={selectedOffer !== null} onOpenChange={handleCloseAcceptModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Aceptás la oferta de {selectedOffer?.courierName}?</DialogTitle>
            <DialogDescription className="sr-only">
              Confirmación de aceptación de la oferta de transporte
            </DialogDescription>
          </DialogHeader>

          {selectedOffer && (
            <div className="space-y-4 py-2 text-sm text-foreground">
              {/* Desglose de tarifa acordada */}
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <span className="font-medium text-muted-foreground">Tarifa acordada</span>
                <span className="text-lg font-bold text-foreground">
                  {formatArs(selectedOffer.amountArs)}
                </span>
              </div>

              {/* Desglose de medio de pago */}
              <div className="space-y-1 text-sm text-foreground">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Medio de pago:</span>
                  <span className="font-semibold">
                    {request.recipientPaymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                  </span>
                </div>
                {request.needsChange && (
                  <div className="text-muted-foreground">
                    El destinatario necesita cambio
                    {request.cashChangeAmount &&
                      ` (paga con ${formatArs(request.cashChangeAmount)})`}
                  </div>
                )}
              </div>

              {/* Texto de revelación progresiva D3 */}
              <p className="rounded-lg border border-border bg-card p-3 text-sm leading-relaxed text-muted-foreground">
                Al aceptar, {courierFirstName} va a ver la dirección de retiro, la de entrega y los
                datos de tu cliente. Las otras ofertas se rechazan.
              </p>

              {/* Error si falla la aceptación */}
              {acceptError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{acceptError}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={handleCloseAcceptModal}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="default"
              isPending={isSubmitting}
              onClick={handleConfirmAccept}
            >
              Sí, aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
