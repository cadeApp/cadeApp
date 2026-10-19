import 'server-only';

import * as React from 'react';
import type { RequestCancellationHistory } from '@/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { getCancellationHistory } from '../queries';
import { CANCELLATION_HISTORY_COPY } from '../cancellation-history-copy';
import { CancellationHistoryList } from './cancellation-history-list';

export type CancellationHistoryViewer = 'merchant' | 'courier';

interface CancellationHistoryCardProps {
  requestId: string;
  viewer: CancellationHistoryViewer;
  history: RequestCancellationHistory;
}

/** Tarjeta con la cronología ya cargada. */
export function CancellationHistoryCard({ requestId, viewer, history }: CancellationHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{CANCELLATION_HISTORY_COPY.title}</CardTitle>
        <CardDescription>
          {viewer === 'merchant'
            ? CANCELLATION_HISTORY_COPY.merchantDescription
            : CANCELLATION_HISTORY_COPY.courierDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.events.length === 0 ? (
          // Texto estático: sin role="status", para no sumar una segunda región viva a la página (el aviso offline y
          // los toasts ya usan esa región).
          <p className="text-sm text-muted-foreground">
            {CANCELLATION_HISTORY_COPY.empty}
          </p>
        ) : (
          <CancellationHistoryList
            requestId={requestId}
            initialEvents={history.events}
            initialNextCursor={history.pagination.nextCursor}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface CancellationHistorySectionProps {
  requestId: string;
  viewer: CancellationHistoryViewer;
}

/**
 * T-373: carga la primera página del historial (CC-032) con la sesión del usuario. Va dentro de un `Suspense` con
 * `CancellationHistorySkeleton` para no frenar el resto del detalle.
 * - Comercio dueño: siempre se muestra, con estado vacío si ningún repartidor canceló.
 * - Repartidor: solo si tiene cancelaciones propias. Si la RPC responde NOT_FOUND (no canceló en este pedido), no se
 *   muestra nada, así no se revela si otros repartidores cancelaron.
 */
export async function CancellationHistorySection({ requestId, viewer }: CancellationHistorySectionProps) {
  const result = await getCancellationHistory(requestId);

  if (!result.ok) {
    if (viewer === 'courier' && result.code === 'NOT_FOUND') return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{CANCELLATION_HISTORY_COPY.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="text-sm text-destructive">
            {CANCELLATION_HISTORY_COPY.error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (viewer === 'courier' && result.data.events.length === 0) return null;

  return <CancellationHistoryCard requestId={requestId} viewer={viewer} history={result.data} />;
}
