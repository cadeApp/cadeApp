import * as React from 'react';
import { notFound } from 'next/navigation';
import { getApplicantDetail } from '@/features/admin/server';
import { ApplicantDetailView } from '@/features/admin';

export const metadata = {
  title: 'Detalle de Postulante | cadeApp Admin',
  description: 'Visor documental y decisión sobre el repartidor postulante',
};

interface ApplicantDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicantDetailPage({ params }: ApplicantDetailPageProps) {
  const resolvedParams = await params;
  const applicant = await getApplicantDetail(resolvedParams.id);

  if (!applicant) {
    notFound();
  }

  return <ApplicantDetailView applicant={applicant} />;
}
