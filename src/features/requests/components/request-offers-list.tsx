'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Clock, ShieldCheck, Bike, Car, AlertTriangle, ArrowRight } from 'lucide-react';
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
import { useRequestOffers } from '../hooks/use-request-offers';
import type { MerchantOfferItem } from '../types';

export interface RequestOffersListProps {
  request: {
    id: string;
    pickupZoneName: string;
    dropoffZoneName: string;
    approxDistanceKm: string;
    packageType: 'sobre' | 'chico' | 'mediano' | 'grande' | string;
    recipientPaymentMethod: 'cash' | 'transfer' | 'to_agree' | string;
    needsChange: boolean;
    cashChangeAmount: number | null;
    status: string;
    expiresAt: string | null;
  };
  initialOffers: readonly MerchantOfferItem[];
  onRegisterRealtime?: (callback: (newOffer: MerchantOfferItem) => void) => void;
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
  onRegisterRealtime,
  onAcceptSuccess,
}: RequestOffersListProps) {
  const { offers, setOffers } = useRequestOffers(request.id, initialOffers);
  const [sortOrder, setSortOrder] = useState<OfferSortOrder>('doc_level');
  const [selectedOffer, setSelectedOffer] = useState<MerchantOfferItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Soporte para callback artificial de tests previos si se proporciona
  useEffect(() => {
    if (onRegisterRealtime) {
      onRegisterRealtime((newOffer: MerchantOfferItem) => {
        setOffers((prev) => {
          const exists = prev.some((o) => o.id === newOffer.id);
          if (exists) {
            return prev.map((o) => (o.id === newOffer.id ? newOffer : o));
          }
          return [...prev, newOffer];
        });
      });
    }
  }, [onRegisterRealtime, setOffers]);

  // Cronómetro de vencimiento
  useEffect(() => {
    if (!request.expiresAt) return;

    function updateTimer() {
      const expiresTime = new Date(request.expiresAt!).getTime();
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
    <div className="flex flex-col space-y-6">
      {/* Resumen de la solicitud */}
      <Card className="border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
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

      {/* Lista de ofertas */}
      {sortedOffers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-border bg-card">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Clock className="h-6 w-6 text-muted-foreground animate-pulse" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Esperando ofertas</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Los repartidores de Aguilares están viendo tu solicitud. Las ofertas van a aparecer acá
            en tiempo real sin recargar la página.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col space-y-3">
          {sortedOffers.map((offer) => (
            <Card
              key={offer.id}
              className="flex flex-col justify-between gap-4 p-4 border-border bg-card transition-shadow hover:shadow-md sm:flex-row sm:items-center"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-bold text-foreground">{offer.courierName}</h4>
                  <span className="text-sm text-muted-foreground font-medium">
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
                    <Badge variant="declared">
                      Documentación en revisión
                    </Badge>
                  )}
                </div>

                {/* Mensaje opcional del repartidor */}
                {offer.message && (
                  <p className="text-sm text-muted-foreground italic">&ldquo;{offer.message}&rdquo;</p>
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
        </div>
      )}

      {/* Modal C05: Confirmar aceptación */}
      <Dialog open={selectedOffer !== null} onOpenChange={handleCloseAcceptModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              ¿Aceptás la oferta de {selectedOffer?.courierName}?
            </DialogTitle>
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
                    {request.cashChangeAmount && ` (paga con ${formatArs(request.cashChangeAmount)})`}
                  </div>
                )}
              </div>

              {/* Texto de revelación progresiva D3 */}
              <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground leading-relaxed">
                Al aceptar, {courierFirstName} va a ver la dirección de retiro, la de entrega y los
                datos de tu cliente. Las otras ofertas se rechazan.
              </p>

              {/* Error si falla la aceptación */}
              {acceptError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive flex items-center gap-2"
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
