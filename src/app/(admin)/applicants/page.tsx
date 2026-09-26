import { getApplicantsQueue } from '@/features/admin/server';
import { ApplicantsQueue } from '@/features/admin';
import type { AdminApplicantTab } from '@/features/admin';

export const metadata = {
  title: 'Postulantes | cadeApp Admin',
  description: 'Cola de postulantes a repartidor en Aguilares',
};

interface ApplicantsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ApplicantsPage({ searchParams }: ApplicantsPageProps) {
  const resolvedParams = await searchParams;
  const tab = (resolvedParams.tab as AdminApplicantTab) || 'pending';
  const applicants = await getApplicantsQueue(tab);

  return <ApplicantsQueue initialTab={tab} applicants={applicants} />;
}
