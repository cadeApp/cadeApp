import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import {
  CancellationHistorySection,
  CancellationHistorySkeleton,
  CourierCancelledAssignmentView,
  getCancellationHistory,
  getTripDetails,
} from '@/features/trips/server';
import { TripMerchantContainer, TripCourierContainer } from '@/features/trips';
import { ReportIncidentButton } from '@/features/incidents';

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * T-373 / 5-A: un repartidor que ya no está asignado ve sus propias cancelaciones de este pedido en vez del 404. Sin
 * cancelaciones propias, la RPC responde NOT_FOUND y sigue el 404 de siempre.
 */
async function renderCourierCancelledAssignment(requestId: string) {
  const history = await getCancellationHistory(requestId);
  if (!history.ok || history.data.events.length === 0) notFound();
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4">
      <CourierCancelledAssignmentView requestId={requestId} history={history.data} />
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

  const trip = await getTripDetails(id);

  // Instante con el que el botón de reporte evalúa la ventana de 24 h (D05-A).
  const renderedAt = Date.now();
  if (!trip) {
    if (profile.role === 'courier') return renderCourierCancelledAssignment(id);
    notFound();
  }

  if (profile.role === 'merchant') {
    if (trip.merchantId !== user.id) {
      notFound();
    }
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4">
        <TripMerchantContainer trip={trip} />
        <React.Suspense fallback={<CancellationHistorySkeleton />}>
          <CancellationHistorySection requestId={trip.id} viewer="merchant" />
        </React.Suspense>
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
      return renderCourierCancelledAssignment(id);
    }
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4">
        <TripCourierContainer trip={trip} />
        <React.Suspense fallback={<CancellationHistorySkeleton />}>
          <CancellationHistorySection requestId={trip.id} viewer="courier" />
        </React.Suspense>
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
