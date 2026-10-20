import * as React from 'react';
import type { ActionResult, RequestCancellationHistory, RpcErrorCode } from '@/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { CANCELLATION_HISTORY_COPY } from '../cancellation-history-copy';
import { CancellationHistoryList } from './cancellation-history-list';

export type CancellationHistoryViewer = 'merchant' | 'courier';

/** Resultado de la primera página de `get_request_cancellation_history` (CC-032), tal como lo carga la página. */
export type CancellationHistoryResult = ActionResult<
  RequestCancellationHistory,
  RpcErrorCode<'get_request_cancellation_history'>
>;

export interface CancellationHistoryCardProps {
  requestId: string;
  viewer: CancellationHistoryViewer;
  result: CancellationHistoryResult;
}

/**
 * T-373: cronología de cancelaciones de asignación, a partir de la primera página que cargó la página en paralelo
 * con el resto del detalle. La espera visible la cubre el `loading.tsx` de la ruta.
 * - Comercio dueño: siempre se muestra, con estado vacío si ningún repartidor canceló.
 * - Repartidor: solo si tiene cancelaciones propias. Con NOT_FOUND (no canceló en este pedido) no se muestra nada,
 *   así no se revela si otros repartidores cancelaron.
 */
export function CancellationHistoryCard({ requestId, viewer, result }: CancellationHistoryCardProps) {
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

  const history = result.data;
  if (viewer === 'courier' && history.events.length === 0) return null;

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
          <p className="text-sm text-muted-foreground">{CANCELLATION_HISTORY_COPY.empty}</p>
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
