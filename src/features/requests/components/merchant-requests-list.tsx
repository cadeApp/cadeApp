'use client';

import { approxDistanceLabel } from '@/lib/format';
import * as React from 'react';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ArrowRight, Package, Clock, Truck, TrendingUp, CheckCircle2 } from 'lucide-react';
import { formatArs, formatDate } from '@/lib/format';
import { Badge, type BadgeProps } from '@/ui/badge';
import { Button, buttonVariants } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { notify } from '@/ui/notify';
import { getDomainErrorMessage } from '@/lib/error-messages';
import type { ActionResult, DomainErrorCode } from '@/domain/errors';
import type { RpcOutput } from '@/domain/rpc-contracts';
import type { MerchantRequestSummary, MerchantMetrics } from '../types';
import { cancelMerchantRequestAction } from '../actions';
import { MerchantRequestCancelDialog } from './merchant-request-cancel-dialog';
import { useMerchantPanelRefresh } from '../hooks/use-merchant-panel-refresh';

export interface MerchantRequestsListProps {
  readonly requests: readonly MerchantRequestSummary[];
  readonly metrics: MerchantMetrics;
  /** T-417: tarjeta extra de métricas (repartidores conectados), al final de la grilla. */
  readonly extraMetric?: React.ReactNode;
  readonly onCancel?: (
    requestId: string,
    reason: string
  ) => Promise<ActionResult<RpcOutput<'cancel_request'>, DomainErrorCode>>;
}

function getStatusBadgeConfig(
  status: string,
  offersCount: number
): { variant: NonNullable<BadgeProps['variant']>; label: string } {
  switch (status) {
    case 'published':
      if (offersCount > 0) {
        return {
          variant: 'with_offers',
          label: `${offersCount} ${offersCount === 1 ? 'oferta recibida' : 'ofertas recibidas'}`,
        };
      }
      return { variant: 'published', label: 'Esperando ofertas' };
    case 'matched':
      return { variant: 'matched', label: 'Asignada' };
    case 'in_transit':
      return { variant: 'in_transit', label: 'En viaje' };
    case 'delivered':
      return { variant: 'delivered', label: 'Entregada' };
    case 'expired':
      return { variant: 'expired', label: 'Expirada' };
    case 'cancelled':
      return { variant: 'cancelled', label: 'Cancelada' };
    default:
      return { variant: 'outline', label: status };
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

export function MerchantRequestsList({ requests, metrics, extraMetric, onCancel }: MerchantRequestsListProps) {
  const router = useRouter();
  // T-381: el conteo de ofertas de las tarjetas sigue a las pendientes reales al volver al panel.
  useMerchantPanelRefresh();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inFlightRef = React.useRef(false);

  const isCancelable = (req: MerchantRequestSummary) => {
    if (req.status === 'matched') return true;
    if (req.status === 'published') {
      if (!req.expiresAt) return false;
      const expiresAtMs = new Date(req.expiresAt).getTime();
      return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
    }
    return false;
  };

  const handleOpenCancel = (requestId: string) => {
    if (isPending || inFlightRef.current) return;
    setSelectedRequestId(requestId);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = (reason: string) => {
    if (!selectedRequestId || inFlightRef.current) return;
    inFlightRef.current = true;
    const reqId = selectedRequestId;

    startTransition(async () => {
      try {
        const res = onCancel
          ? await onCancel(reqId, reason)
          : await cancelMerchantRequestAction({ requestId: reqId, reason });

        if (res.ok) {
          notify.success('Solicitud cancelada.');
          setCancelModalOpen(false);
          setSelectedRequestId(null);
          router.refresh();
        } else {
          notify.error(getDomainErrorMessage(res.code));
          setCancelModalOpen(false);
          setSelectedRequestId(null);
          router.refresh();
        }
      } catch {
        notify.error('No se pudo conectar para cancelar la solicitud. Intentá nuevamente.');
        setCancelModalOpen(false);
        setSelectedRequestId(null);
        router.refresh();
      } finally {
        inFlightRef.current = false;
      }
    });
  };

  const activeRequests = requests.filter(
    (r) => r.status === 'published' || r.status === 'matched' || r.status === 'in_transit'
  );
  return (
    <div className="flex flex-col space-y-6">
      {/* Encabezado y Acción principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Mis solicitudes</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná tus envíos en tiempo real y revisá las ofertas de repartidores de Aguilares.
          </p>
        </div>

        <Link
          href="/merchant/requests/new"
          className={buttonVariants({ variant: 'default' }) + ' self-start sm:self-auto'}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva solicitud
        </Link>
      </div>

      {/* Métricas C02 (Anti-12px, piso 14px text-sm) */}
      <div className={extraMetric ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' : 'grid grid-cols-1 gap-4 sm:grid-cols-3'}>
        <Card className="flex flex-col justify-between border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Despachos hoy</span>
            <Truck className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {metrics.dispatchedToday}
          </p>
        </Card>

        <Card className="flex flex-col justify-between border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Tarifa promedio</span>
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {metrics.avgRateArs !== null ? formatArs(metrics.avgRateArs) : 'Sin datos'}
          </p>
        </Card>

        <Card className="flex flex-col justify-between border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Solicitudes activas</span>
            <Package className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {metrics.activeCount}
          </p>
        </Card>

        {extraMetric}
      </div>

      {activeRequests.length === 0 ? (
        <EmptyState
          title="No tenés solicitudes activas"
          description="Publicá un nuevo envío para recibir ofertas de repartidores disponibles en Aguilares."
          actionLabel="Nueva solicitud"
          onAction={() => router.push('/merchant/requests/new')}
        />
      ) : (
        <div className="flex flex-col space-y-3">
          {activeRequests.map((req) => {
            const statusConfig = getStatusBadgeConfig(req.status, req.offersCount);
            const isMultiDrop = (req.dropsCount ?? req.drops?.length ?? 1) > 1;
            const destinations =
              req.drops && req.drops.length > 1
                ? req.drops.map((d) => d.dropoffZoneName).join(' · ')
                : req.dropoffZoneName;
            const packagesText =
              req.drops && req.drops.length > 1
                ? `Paquetes: ${req.drops.map((d) => getPackageLabel(d.packageType)).join(', ')}`
                : `Paquete ${getPackageLabel(req.packageType)}`;
            const paymentMethodsText =
              req.drops && req.drops.length > 1
                ? `Medios: ${Array.from(new Set(req.drops.map((d) => (d.recipientPaymentMethod === 'cash' ? 'Efectivo' : 'Transferencia')))).join(', ')}`
                : req.recipientPaymentMethod === 'cash'
                  ? 'Efectivo'
                  : 'Transferencia';

            return (
              <Card
                key={req.id}
                className="border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    {/* Recorrido de zonas y badge accesible */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                        <span>{req.pickupZoneName}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span>{destinations}</span>
                      </div>
                      {isMultiDrop && (
                        <Badge variant="outline">
                          {req.dropsCount ?? req.drops?.length} entregas
                        </Badge>
                      )}
                      <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                    </div>

                    {/* Metadatos operativos */}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {approxDistanceLabel(req.approxDistanceKm)}
                      </span>
                      <span>·</span>
                      <span>{packagesText}</span>
                      <span>·</span>
                      <span>{paymentMethodsText}</span>
                      {req.createdAt && (
                        <>
                          <span>·</span>
                          <span>{formatDate(req.createdAt, 'time')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                    {isCancelable(req) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending || inFlightRef.current}
                        onClick={() => handleOpenCancel(req.id)}
                        className="min-h-12 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Cancelar solicitud ${destinations}`}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Link
                      href={
                        req.status === 'published'
                          ? `/merchant/requests/${req.id}`
                          : `/trips/${req.id}`
                      }
                      className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' min-h-12'}
                    >
                      {req.status === 'published' ? 'Ver ofertas' : 'Ver detalle'}
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <MerchantRequestCancelDialog
        key={selectedRequestId ?? 'cancel-dialog'}
        open={cancelModalOpen}
        onOpenChange={(nextOpen) => {
          if (!isPending && !inFlightRef.current) {
            setCancelModalOpen(nextOpen);
          }
        }}
        onConfirm={handleConfirmCancel}
        isPending={isPending}
      />
    </div>
  );
}
