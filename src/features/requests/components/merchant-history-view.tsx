'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge, type BadgeProps } from '@/ui/badge';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { formatDate } from '@/lib/format';
import { History, ChevronRight } from 'lucide-react';
import type { MerchantRequestSummary } from '../types';

export interface MerchantHistoryViewProps {
  readonly requests: readonly MerchantRequestSummary[];
}

type HistoryTab = 'all' | 'delivered' | 'cancelled' | 'expired';

function getStatusBadgeConfig(status: string): { variant: NonNullable<BadgeProps['variant']>; label: string } {
  switch (status) {
    case 'delivered':
      return { variant: 'delivered', label: 'Entregada' };
    case 'cancelled':
      return { variant: 'cancelled', label: 'Cancelada' };
    case 'expired':
      return { variant: 'expired', label: 'Vencida' };
    case 'in_transit':
      return { variant: 'in_transit', label: 'En camino' };
    case 'matched':
      return { variant: 'matched', label: 'Asignada' };
    case 'published':
      return { variant: 'published', label: 'Publicada' };
    default:
      return { variant: 'outline', label: status };
  }
}

function groupRequestsByDate(requests: readonly MerchantRequestSummary[]): Record<string, MerchantRequestSummary[]> {
  const groups: Record<string, MerchantRequestSummary[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const req of requests) {
    const reqDate = new Date(req.createdAt).toDateString();
    let label = formatDate(req.createdAt);
    if (reqDate === today) {
      label = 'Hoy';
    } else if (reqDate === yesterday) {
      label = 'Ayer';
    }

    const list = groups[label] ?? [];
    list.push(req);
    groups[label] = list;
  }

  return groups;
}

export function MerchantHistoryView({ requests }: MerchantHistoryViewProps) {
  const [activeTab, setActiveTab] = React.useState<HistoryTab>('all');

  const filteredRequests = React.useMemo(() => {
    switch (activeTab) {
      case 'delivered':
        return requests.filter((r) => r.status === 'delivered');
      case 'cancelled':
        return requests.filter((r) => r.status === 'cancelled');
      case 'expired':
        return requests.filter((r) => r.status === 'expired');
      case 'all':
      default:
        return requests;
    }
  }, [requests, activeTab]);

  const grouped = React.useMemo(() => groupRequestsByDate(filteredRequests), [filteredRequests]);
  const dateKeys = Object.keys(grouped);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Historial de envíos
        </h1>
        <p className="text-sm text-muted-foreground">
          Revisá todas las solicitudes finalizadas, entregadas o canceladas.
        </p>
      </div>

      {/* Tabs accesibles */}
      <div
        role="tablist"
        aria-label="Filtro de historial"
        className="flex w-full rounded-xl border border-border bg-muted p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          className={`min-h-10 flex-1 rounded-lg px-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'all'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Todas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'delivered'}
          onClick={() => setActiveTab('delivered')}
          className={`min-h-10 flex-1 rounded-lg px-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'delivered'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Entregadas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cancelled'}
          onClick={() => setActiveTab('cancelled')}
          className={`min-h-10 flex-1 rounded-lg px-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'cancelled'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Canceladas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'expired'}
          onClick={() => setActiveTab('expired')}
          className={`min-h-10 flex-1 rounded-lg px-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'expired'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Vencidas
        </button>
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
              <h2 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-wider">
                {dateLabel}
              </h2>
              <div className="space-y-2.5">
                {grouped[dateLabel]?.map((req) => {
                  const badge = getStatusBadgeConfig(req.status);
                  return (
                    <Link
                      key={req.id}
                      href={`/merchant/requests/${req.id}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                    >
                      <Card className="flex items-center justify-between p-3.5 transition-colors hover:border-border/80 hover:bg-card/80">
                        <div className="space-y-1 pr-3">
                          <p className="font-display text-base font-bold text-foreground">
                            {req.pickupZoneName} → {req.dropoffZoneName}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span>≈ {req.approxDistanceKm} km</span>
                            <span>·</span>
                            <span className="capitalize">{req.packageType}</span>
                            <span>·</span>
                            <span>{new Date(req.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={badge.variant} className="text-xs">
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
        </div>
      )}
    </div>
  );
}
