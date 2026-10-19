import * as React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getMerchantRequestWithOffers } from '@/features/requests/server';
import { RequestOffersList } from '@/features/requests';
import { CancellationHistoryCard } from '@/features/trips';
import { loadCancellationHistoryForRequestDetail } from '@/features/trips/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { buttonVariants } from '@/ui/button';

interface MerchantRequestDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CanonicalMerchantRequestDetailPage({
  params,
}: MerchantRequestDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const result = await getMerchantRequestWithOffers(id, user.id);

  if (!result) {
    notFound();
  }

  const { request } = result;

  if (
    request.status === 'matched' ||
    request.status === 'in_transit' ||
    request.status === 'delivered'
  ) {
    redirect(`/trips/${id}`);
  }

  // T-373 / PR425-H03: el historial (CC-032) se lee solo en las ramas que lo muestran; la RPC exige que sea del comercio.
  const cancellationHistory = await loadCancellationHistoryForRequestDetail(id, request.status);

  if (request.status === 'cancelled' || request.status === 'expired') {
    const isCancelled = request.status === 'cancelled';
    const statusLabel = isCancelled ? 'Cancelada' : 'Expirada';
    const badgeVariant = isCancelled ? 'cancelled' : 'expired';

    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Solicitud de envío</CardTitle>
              <Badge variant={badgeVariant}>{statusLabel}</Badge>
            </div>
            <CardDescription>
              {isCancelled
                ? 'Esta solicitud fue cancelada y ya no recibe ofertas ni asignaciones.'
                : 'Esta solicitud expiró sin haber concretado una asignación de repartidor.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-2 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Origen:</span>{' '}
                <span className="font-semibold text-foreground">{request.pickupZoneName}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Destino:</span>{' '}
                <span className="font-semibold text-foreground">{request.dropoffZoneName}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Paquete:</span>{' '}
                <span className="capitalize text-foreground">{request.packageType}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Pago:</span>{' '}
                <span className="capitalize text-foreground">{request.recipientPaymentMethod}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Link
              href="/merchant/history"
              className={buttonVariants({ variant: 'outline', size: 'default' })}
            >
              Ver historial
            </Link>
            <Link
              href="/merchant/requests/new"
              className={buttonVariants({ variant: 'default', size: 'default' })}
            >
              Crear nueva solicitud
            </Link>
          </CardFooter>
        </Card>
        {cancellationHistory ? (
          <div className="mt-4">
            <CancellationHistoryCard requestId={id} viewer="merchant" result={cancellationHistory} />
          </div>
        ) : null}
      </div>
    );
  }

  if (request.status === 'draft') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Solicitud en borrador</CardTitle>
              <Badge variant="outline">Borrador</Badge>
            </div>
            <CardDescription>
              Esta solicitud aún no fue publicada para recibir ofertas de repartidores.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Zona de retiro: <strong className="text-foreground">{request.pickupZoneName}</strong>
            </p>
            <p>
              Zona de entrega: <strong className="text-foreground">{request.dropoffZoneName}</strong>
            </p>
          </CardContent>
          <CardFooter>
            <Link
              href="/merchant/dashboard"
              className={buttonVariants({ variant: 'default', size: 'default' })}
            >
              Volver al panel
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <RequestOffersList
        request={result.request}
        initialOffers={result.offers}
        initialNextCursor={result.nextOffersCursor}
      />
      {/* T-373: un pedido reabierto tras una cancelación del repartidor sigue publicado; la cronología lo explica. */}
      {cancellationHistory ? (
        <div className="mx-auto w-full max-w-3xl">
          <CancellationHistoryCard requestId={id} viewer="merchant" result={cancellationHistory} />
        </div>
      ) : null}
    </div>
  );
}
