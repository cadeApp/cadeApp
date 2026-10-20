import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getTripDetails } from '@/features/trips/server';
import {
  CourierCancelledAssignmentView,
  TripMerchantContainer,
  TripCourierContainer,
  selectCourierCancelledAssignment,
  type CancellationHistoryResult,
} from '@/features/trips';
import { getRequestCancellationHistoryServer } from '@/server/rpc/request-cancellation-history';
import { ReportIncidentButton } from '@/features/incidents';

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * T-373 / 5-A: un repartidor sin viaje visible (get_trip_details ya no lo reconoce como asignado) ve sus propias
 * cancelaciones de este pedido. Sin cancelaciones propias sigue el 404; una falla del historial va al `error.tsx`
 * (PR425-H04), nunca al 404.
 */
function renderCourierCancelledAssignment(requestId: string, result: CancellationHistoryResult) {
  const history = selectCourierCancelledAssignment(result, notFound);
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4">
      <CourierCancelledAssignmentView requestId={requestId} history={history} />
    </div>
  );
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (profileError || !profile) {
    notFound();
  }

  // T-373: el historial (CC-032) se lee en paralelo con el viaje; la RPC decide qué ve cada actor.
  const [trip, cancellationHistory] = await Promise.all([
    getTripDetails(id),
    getRequestCancellationHistoryServer({ requestId: id }),
  ]);

  // Instante con el que el botón de reporte evalúa la ventana de 24 h (D05-A).
  const renderedAt = Date.now();
  if (!trip) {
    if (profile.role === 'courier') return renderCourierCancelledAssignment(id, cancellationHistory);
    notFound();
  }

  if (profile.role === 'merchant') {
    if (trip.merchantId !== user.id) {
      notFound();
    }
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4">
        <TripMerchantContainer trip={trip} cancellationHistory={cancellationHistory} />
        <ReportIncidentButton
          requestId={trip.id}
          actorRole={profile.role}
          tripStatus={trip.status}
          deliveredAt={trip.deliveredAt}
          now={renderedAt}
        />
      </div>
    );
  }

  if (profile.role === 'courier') {
    if (trip.courierId !== user.id) {
      // get_trip_details rechaza al repartidor no asignado (el fallback 5-A entra por `trip` null); un viaje visible
      // de otro repartidor nunca se reemplaza por historial.
      notFound();
    }
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4">
        <TripCourierContainer trip={trip} cancellationHistory={cancellationHistory} />
        <ReportIncidentButton
          requestId={trip.id}
          actorRole={profile.role}
          tripStatus={trip.status}
          deliveredAt={trip.deliveredAt}
          now={renderedAt}
        />
      </div>
    );
  }

  notFound();
}
