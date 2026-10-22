import * as React from 'react';
import { notFound } from 'next/navigation';
import { getIncidentDetail, IncidentDetailPanel } from '@/features/incidents/server';

export const metadata = {
  title: 'Detalle del incidente | cadeApp Admin',
  description: 'Mediación y resolución de un incidente reportado',
};

interface IncidentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { id } = await params;
  const incident = await getIncidentDetail(id);
  if (!incident) {
    notFound();
  }

  return <IncidentDetailPanel incident={incident} />;
}
