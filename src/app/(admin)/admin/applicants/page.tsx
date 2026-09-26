import { getApplicantsQueue, parseAdminApplicantsSearchParams } from '@/features/admin/server';
import { ApplicantsQueue } from '@/features/admin';

export const metadata = {
  title: 'Postulantes | cadeApp Admin',
  description: 'Cola de postulantes a repartidor en Aguilares',
};

interface ApplicantsPageProps {
  searchParams: Promise<{ tab?: string; page?: string }>;
}

export default async function ApplicantsPage({ searchParams }: ApplicantsPageProps) {
  const resolvedParams = await searchParams;
  const { tab, page } = parseAdminApplicantsSearchParams(resolvedParams);
  const queueResult = await getApplicantsQueue(tab, { page, pageSize: 20 });

  return (
    <ApplicantsQueue
      initialTab={tab}
      applicants={queueResult.items}
      page={queueResult.page}
      pageSize={queueResult.pageSize}
      totalCount={queueResult.totalCount}
      totalPages={queueResult.totalPages}
    />
  );
}
