'use client';

import * as React from 'react';
import Link from 'next/link';
import { History, ChevronRight } from 'lucide-react';
import { Card } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { EmptyState } from '@/ui/empty-state';
import { buttonVariants } from '@/ui/button';
import { cn } from '@/ui/cn';
import type { MerchantRequestSummary } from '../types';

type FilterTab = 'all' | 'delivered' | 'cancelled' | 'expired';

function getDateGroupLabel(dateIso: string): string {
  const d = new Date(dateIso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (target.getTime() === today.getTime()) return 'Hoy';
  if (target.getTime() === yesterday.getTime()) return 'Ayer';

  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  });
}

function getStatusBadgeConfig(status: MerchantRequestSummary['status']) {
  switch (status) {
    case 'delivered':
      return { variant: 'delivered' as const, label: 'Entregada' };
    case 'cancelled':
      return { variant: 'cancelled' as const, label: 'Cancelada' };
    case 'expired':
      return { variant: 'expired' as const, label: 'Vencida' };
    case 'matched':
      return { variant: 'matched' as const, label: 'Asignada' };
    case 'in_transit':
      return { variant: 'in_transit' as const, label: 'En camino' };
    default:
      return { variant: 'published' as const, label: 'Publicada' };
  }
}

export function MerchantHistoryView({
  requests,
  nextCursor = null,
  activeStatus = 'all',
}: {
  requests: readonly MerchantRequestSummary[];
  nextCursor?: { readonly createdAt: string; readonly id: string } | null;
  activeStatus?: FilterTab;
}) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>(activeStatus);

  React.useEffect(() => {
    setActiveTab(activeStatus);
  }, [activeStatus]);

  const filteredRequests = React.useMemo(() => {
    if (activeTab === 'all') return requests;
    return requests.filter((r) => r.status === activeTab);
  }, [requests, activeTab]);

  const grouped = React.useMemo(() => {
    const groups: Record<string, MerchantRequestSummary[]> = {};
    for (const req of filteredRequests) {
      const label = getDateGroupLabel(req.createdAt);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(req);
    }
    return groups;
  }, [filteredRequests]);

  const dateKeys = Object.keys(grouped);

  const buildNextCursorHref = (cursor: { readonly createdAt: string; readonly id: string }) => {
    const params = new URLSearchParams();
    if (activeTab !== 'all') {
      params.set('status', activeTab);
    }
    params.set('cursorCreatedAt', cursor.createdAt);
    params.set('cursorId', cursor.id);
    return `/merchant/history?${params.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Historial de envíos
        </h1>
        <p className="text-sm text-muted-foreground">
          Revisá todas las solicitudes finalizadas, entregadas o canceladas.
        </p>
      </div>

      {/* Tabs accesibles con altura mínima de 48px (min-h-12) y sincronización con searchParams */}
      <div
        role="tablist"
        aria-label="Filtro de historial"
        className="flex w-full rounded-xl border border-border bg-muted p-1"
      >
        <Link
          href="/merchant/history?status=all"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'all'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Todas
        </Link>
        <Link
          href="/merchant/history?status=delivered"
          role="tab"
          aria-selected={activeTab === 'delivered'}
          onClick={() => setActiveTab('delivered')}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'delivered'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Entregadas
        </Link>
        <Link
          href="/merchant/history?status=cancelled"
          role="tab"
          aria-selected={activeTab === 'cancelled'}
          onClick={() => setActiveTab('cancelled')}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'cancelled'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Canceladas
        </Link>
        <Link
          href="/merchant/history?status=expired"
          role="tab"
          aria-selected={activeTab === 'expired'}
          onClick={() => setActiveTab('expired')}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'expired'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Vencidas
        </Link>
      </div>

      {/* Lista agrupada o Estado Vacío */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="No hay solicitudes en esta sección"
          description="Los envíos que publiques y completen su ciclo van a aparecer organizados acá."
        />
      ) : (
        <div className="space-y-5">
          {dateKeys.map((dateLabel) => (
            <div key={dateLabel} className="space-y-2">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {dateLabel}
              </h2>
              <div className="space-y-2.5">
                {grouped[dateLabel]?.map((req) => {
                  const badge = getStatusBadgeConfig(req.status);
                  return (
                    <Link
                      key={req.id}
                      href={`/merchant/requests/${req.id}`}
                      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Card className="flex items-center justify-between p-4 transition-colors hover:border-border/80 hover:bg-card/80">
                        <div className="space-y-1 pr-3">
                          <p className="font-display text-base font-bold text-foreground">
                            {req.pickupZoneName} → {req.dropoffZoneName}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                            <span>
                              {req.approxDistanceKm
                                ? `≈ ${req.approxDistanceKm} km`
                                : 'Distancia no calculada'}
                            </span>
                            <span>·</span>
                            <span className="capitalize">{req.packageType}</span>
                            <span>·</span>
                            <span>
                              {new Date(req.createdAt).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={badge.variant} className="text-sm">
                            {badge.label}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {nextCursor ? (
            <div className="pt-2">
              <Link
                href={buildNextCursorHref(nextCursor)}
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}
              >
                Ver siguientes envíos
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
