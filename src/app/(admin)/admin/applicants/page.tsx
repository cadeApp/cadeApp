import { getApplicantsQueue, parseAdminApplicantsSearchParams } from '@/features/admin/server';
import { ApplicantsQueue } from '@/features/admin';

export const metadata = {
  title: 'Postulantes | cadeApp Admin',
  description: 'Cola de postulantes a repartidor en Aguilares',
};

interface ApplicantsPageProps {
  searchParams: Promise<{ tab?: string; cursor?: string }>;
}

export default async function ApplicantsPage({ searchParams }: ApplicantsPageProps) {
  const resolvedParams = await searchParams;
  const { tab, cursor } = parseAdminApplicantsSearchParams(resolvedParams);
  const queueResult = await getApplicantsQueue(tab, { cursor, pageSize: 20 });

  return (
    <ApplicantsQueue
      initialTab={tab}
      applicants={queueResult.items}
      pageSize={queueResult.pageSize}
      nextCursor={queueResult.nextCursor}
      hasNextPage={queueResult.hasNextPage}
    />
  );
}
