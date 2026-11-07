import * as React from 'react';
import { notFound } from 'next/navigation';
import { AdminTripDetailView, getAdminTripDetail } from '@/features/admin-trips/server';

export const metadata = {
  title: 'Detalle del viaje | cadeApp Admin',
  description: 'Partes, cronología, entregas e incidentes de un viaje',
};

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
  const trip = await getAdminTripDetail(id);
  if (!trip) {
    notFound();
  }

  return <AdminTripDetailView trip={trip} />;
}
