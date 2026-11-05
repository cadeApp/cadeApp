import { getApplicantsQueue, parseAdminApplicantsSearchParams } from '@/features/admin/server';
import { ApplicantsQueue } from '@/features/admin';

export const metadata = {
  title: 'Postulantes | cadeApp Admin',
  description: 'Cola de postulantes a repartidor en Aguilares',
};

interface ApplicantsPageProps {
  searchParams: Promise<{ tab?: string; cursor?: string; dir?: string; q?: string }>;
}

export default async function ApplicantsPage({ searchParams }: ApplicantsPageProps) {
  const resolvedParams = await searchParams;
  const { tab, cursor, direction, query } = parseAdminApplicantsSearchParams(resolvedParams);
  const queueResult = await getApplicantsQueue(tab, { cursor, direction, query, pageSize: 20 });

  return (
    <ApplicantsQueue
      // La pestaña y la búsqueda reinician el estado local del buscador.
      key={`${tab}:${query ?? ''}`}
      initialTab={tab}
      applicants={queueResult.items}
      total={queueResult.total}
      query={query}
      pageSize={queueResult.pageSize}
      nextCursor={queueResult.nextCursor}
      prevCursor={queueResult.prevCursor}
      now={new Date().toISOString()}
    />
  );
}
