'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, ShieldCheck, AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { sortOffersForMerchant, type OfferSortOrder } from '@/domain/priority';
import { formatArs } from '@/lib/format';
import { Badge } from '@/ui/badge';
import { Button, buttonVariants } from '@/ui/button';
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
import type { MerchantOfferItem, MerchantDropSummary } from '../types';
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
    acceptedOfferId?: string | null;
    dropsCount?: number;
    drops?: readonly MerchantDropSummary[];
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
  const router = useRouter();
  const {
    offers,
    hasNextPage,
    fetchNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    refetch,
    isOnline = true,
    offersSyncedAfterReconnect = true,
  } = useRequestOffers(request.id, initialOffers, initialNextCursor ?? null);
  const [sortOrder, setSortOrder] = useState<OfferSortOrder>('doc_level');
  const [selectedOffer, setSelectedOffer] = useState<MerchantOfferItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(() => {
    if (!request.expiresAt) return false;
    return new Date(request.expiresAt).getTime() <= Date.now();
  });
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  const isAcceptableStatus =
    request.status === 'published' && !isExpired && !isReconciling;
  const isMatchedOrLater =
    request.status === 'matched' ||
    request.status === 'in_transit' ||
    request.status === 'delivered';

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
        setIsExpired(true);
        return;
      }

      setIsExpired(false);
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

  const canAccept = request.status === 'published' && isOnline && offersSyncedAfterReconnect;
  const isOfferEligible = (o: MerchantOfferItem) =>
    o.status === 'pending' && canAccept && !isExpired && !isReconciling;

  // PR390-H17: El botón y handler de Cargar más se bloquean mientras haya peticiones en vuelo,
  // la app esté offline o la reconexión aún no haya completado la sincronización total.
  const isLoadMoreDisabled =
    Boolean(isFetching) ||
    Boolean(isFetchingNextPage) ||
    !isOnline ||
    !offersSyncedAfterReconnect;

  const handleLoadMore = () => {
    if (isLoadMoreDisabled || !hasNextPage) return;
    void fetchNextPage();
  };

  // PR390-H05: Una vez que el hook entrega lista actual, la fuente de verdad de elegibilidad es offers (la query del cliente).
  // Si la oferta seleccionada desaparece de la lista actual, pasa a terminal o el pedido deja de ser aceptable, cerrar modal.
  // No borrar acceptError aquí para comunicar error accesible aun si el modal desaparece tras refetch.
  useEffect(() => {
    if (!selectedOffer) return;
    const currentOffer = offers.find((o) => o.id === selectedOffer.id);
    if (!currentOffer || currentOffer.status !== 'pending' || !canAccept) {
      setSelectedOffer(null);
    }
  }, [offers, canAccept, selectedOffer]);

  const handleOpenAcceptModal = (offer: MerchantOfferItem) => {
    const currentExpired = Boolean(
      request.expiresAt && new Date(request.expiresAt).getTime() <= Date.now()
    );
    if (!isOfferEligible(offer) || currentExpired || isReconciling) return;
    setAcceptError(null);
    setSelectedOffer(offer);
  };

  const handleCloseAcceptModal = () => {
    if (isSubmitting) return;
    setSelectedOffer(null);
    setAcceptError(null);
  };

  const handleConfirmAccept = async () => {
    if (!selectedOffer || isReconciling) return;

    const currentExpired = Boolean(
      request.expiresAt && new Date(request.expiresAt).getTime() <= Date.now()
    );
    if (request.status !== 'published' || isExpired || currentExpired) {
      setIsReconciling(true);
      notify.error('La solicitud ha expirado.');
      setSelectedOffer(null);
      router.refresh();
      return;
    }

    if (!canAccept) return;

    const currentOffer = offers.find((o) => o.id === selectedOffer.id);
    if (!currentOffer || currentOffer.status !== 'pending') {
      setSelectedOffer(null);
      setAcceptError('Esta oferta ya no está disponible.');
      return;
    }

    setIsSubmitting(true);
    setAcceptError(null);

    try {
      const res = await acceptOfferAction({ offerId: currentOffer.id });
      if (res.ok) {
        notify.success('¡Oferta aceptada! El repartidor ya va en camino.');
        setSelectedOffer(null);
        onAcceptSuccess?.(currentOffer.id);
        router.replace(`/trips/${request.id}`);
      } else {
        if (res.code === 'OFFER_NOT_PENDING') {
          setAcceptError('Esta oferta ya no está disponible.');
          void refetch();
        } else if (res.code === 'ALREADY_MATCHED') {
          setIsReconciling(true);
          setAcceptError(
            'Esta solicitud ya fue asignada a otro repartidor o la oferta no está disponible.'
          );
          notify.error('Esta solicitud ya fue asignada a otro repartidor.');
          setSelectedOffer(null);
          router.refresh();
          void refetch();
        } else if (res.code === 'REQUEST_EXPIRED') {
          setIsReconciling(true);
          setAcceptError('La solicitud ha expirado.');
          notify.error('La solicitud ha expirado.');
          setSelectedOffer(null);
          router.refresh();
          void refetch();
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
      {/* Aviso de error de aceptación */}
      {acceptError && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{acceptError}</p>
          </div>
          {isReconciling && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
              className="shrink-0 self-start sm:self-auto"
            >
              Reintentar consulta
            </Button>
          )}
        </div>
      )}

      {/* Aviso de asignación C06 */}
      {isMatchedOrLater && (
        <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">
              Esta solicitud ya tiene un repartidor asignado
            </p>
            <p className="text-sm text-muted-foreground">
              Podés consultar los datos del repartidor, contactos y estado del envío en el detalle del viaje.
            </p>
          </div>
          <Link
            href={`/trips/${request.id}`}
            className={buttonVariants({ variant: 'default', size: 'sm' }) + ' shrink-0 self-start sm:self-auto'}
          >
            Ver viaje asignado
          </Link>
        </Card>
      )}

      {/* Resumen de la solicitud */}
      <Card className="border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
              <span>{request.pickupZoneName}</span>
              <ArrowRight className="h-4 w-4" />
              <span>
                {request.drops && request.drops.length > 1
                  ? request.drops.map((d) => d.dropoffZoneName).join(' · ')
                  : request.dropoffZoneName}
              </span>
              <span>·</span>
              <span>
                {request.approxDistanceKm
                  ? `≈ ${request.approxDistanceKm} km`
                  : 'Distancia no calculada'}
              </span>
              {(request.dropsCount ?? request.drops?.length ?? 1) > 1 && (
                <Badge variant="outline">
                  {request.dropsCount ?? request.drops?.length} entregas
                </Badge>
              )}
            </div>
            {request.drops && request.drops.length > 1 ? (
              <div className="mt-2 space-y-1 border-t border-border pt-2 text-sm text-muted-foreground">
                {request.drops.map((drop) => (
                  <div key={drop.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">Entrega {drop.position}:</span>
                    <span>{drop.dropoffZoneName}</span>
                    <span>·</span>
                    <span>Paquete {getPackageLabel(drop.packageType)}</span>
                    <span>·</span>
                    <span>
                      {drop.recipientPaymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
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
            )}
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
            className={`min-h-12 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
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
            className={`min-h-12 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
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

                {isOfferEligible(offer) ? (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => handleOpenAcceptModal(offer)}
                  >
                    Aceptar
                  </Button>
                ) : offer.status === 'accepted' || offer.id === request.acceptedOfferId ? (
                  <Badge variant="matched">Oferta aceptada</Badge>
                ) : offer.status === 'rejected' ? (
                  <Badge variant="outline">Rechazada</Badge>
                ) : offer.status === 'withdrawn' ? (
                  <Badge variant="outline">Retirada</Badge>
                ) : null}
              </div>
            </Card>
          ))}
          {hasNextPage && !isError && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadMoreDisabled}
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
              disabled={!selectedOffer || !canAccept || isSubmitting || isReconciling}
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
