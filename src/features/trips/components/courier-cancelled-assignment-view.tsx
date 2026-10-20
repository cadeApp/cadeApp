import * as React from 'react';
import Link from 'next/link';
import type { RequestCancellationHistory } from '@/domain';
import { buttonVariants } from '@/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/card';
import { CANCELLATION_HISTORY_COPY } from '../cancellation-history-copy';
import { CancellationHistoryList } from './cancellation-history-list';

export interface CourierCancelledAssignmentViewProps {
  requestId: string;
  history: RequestCancellationHistory;
}

/**
 * T-373 / decisión 5-A: lo que ve en `/trips/[id]` un repartidor que ya no está asignado pero canceló la asignación de
 * este pedido. Solo muestra sus propios eventos (los filtra la RPC) y nada del viaje: ni direcciones ni contactos.
 */
export function CourierCancelledAssignmentView({ requestId, history }: CourierCancelledAssignmentViewProps) {
  return (
    <Card>
      <CardHeader>
        <h1 className="font-display text-xl font-bold text-foreground">
          {CANCELLATION_HISTORY_COPY.courierCancelledTitle}
        </h1>
        <CardDescription>{CANCELLATION_HISTORY_COPY.courierCancelledDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <CardTitle className="text-base">{CANCELLATION_HISTORY_COPY.title}</CardTitle>
        <CancellationHistoryList
          requestId={requestId}
          initialEvents={history.events}
          initialNextCursor={history.pagination.nextCursor}
        />
      </CardContent>
      <CardFooter>
        <Link href="/courier/feed" className={buttonVariants({ variant: 'default', size: 'default' })}>
          {CANCELLATION_HISTORY_COPY.backToFeed}
        </Link>
      </CardFooter>
    </Card>
  );
}
