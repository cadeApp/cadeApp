import { notFound } from 'next/navigation';
import { getApplicantDetail } from '@/features/admin/server';
import { ApplicantDetailView, adminApplicantIdSchema } from '@/features/admin';

export const metadata = {
  title: 'Detalle de Postulante | cadeApp Admin',
  description: 'Visor documental y decisión sobre el repartidor postulante',
};

interface ApplicantDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicantDetailPage({ params }: ApplicantDetailPageProps) {
  const resolvedParams = await params;
  const parsedId = adminApplicantIdSchema.safeParse(resolvedParams.id);
  if (!parsedId.success) {
    notFound();
  }

  const applicant = await getApplicantDetail(parsedId.data);

  if (!applicant) {
    notFound();
  }

  return <ApplicantDetailView applicant={applicant} />;
}
