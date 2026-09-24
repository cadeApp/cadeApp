'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ArrowRight, Package, Clock, Truck, TrendingUp, CheckCircle2 } from 'lucide-react';
import { formatArs, formatDate } from '@/lib/format';
import { Badge, type BadgeProps } from '@/ui/badge';
import { Button, buttonVariants } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import type { MerchantRequestSummary, MerchantMetrics } from '../types';

export interface MerchantRequestsListProps {
  readonly requests: readonly MerchantRequestSummary[];
  readonly metrics: MerchantMetrics;
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

export function MerchantRequestsList({ requests, metrics }: MerchantRequestsListProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col space-y-6">
      {/* Encabezado y Acción principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Mis solicitudes</h1>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Despachos hoy</p>
              <h3 className="text-xl font-bold font-display text-foreground">
                {metrics.dispatchedToday}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tarifa promedio</p>
              <h3 className="text-xl font-bold font-display text-foreground">
                {formatArs(metrics.avgRateArs)}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Solicitudes activas</p>
              <h3 className="text-xl font-bold font-display text-foreground">
                {metrics.activeCount}
              </h3>
            </div>
          </div>
        </Card>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No tenés solicitudes activas"
          description="Publicá un nuevo envío para recibir ofertas de repartidores disponibles en Aguilares."
          actionLabel="Nueva solicitud"
          onAction={() => router.push('/merchant/requests/new')}
        />
      ) : (
        <div className="flex flex-col space-y-3">
          {requests.map((req) => {
            const statusConfig = getStatusBadgeConfig(req.status, req.offersCount);

            return (
              <Card
                key={req.id}
                className="p-4 border-border bg-card transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    {/* Recorrido de zonas y badge accesible */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                        <span>{req.pickupZoneName}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span>{req.dropoffZoneName}</span>
                      </div>
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Metadatos operativos */}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{req.approxDistanceKm} km</span>
                      <span>·</span>
                      <span>Paquete {getPackageLabel(req.packageType)}</span>
                      <span>·</span>
                      <span>
                        {req.recipientPaymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                      </span>
                      {req.createdAt && (
                        <>
                          <span>·</span>
                          <span>{formatDate(req.createdAt, 'time')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link
                      href={`/merchant/requests/${req.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
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
    </div>
  );
}
