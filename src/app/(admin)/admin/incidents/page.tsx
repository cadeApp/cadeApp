import * as React from 'react';
import { getIncidentsQueue, parseIncidentsSearchParams } from '@/features/incidents/server';
import { IncidentsInbox } from '@/features/incidents';

export const metadata = {
  title: 'Incidentes | cadeApp Admin',
  description: 'Reclamos de comercios y repartidores de Aguilares para mediar y resolver',
};

interface IncidentsPageProps {
  searchParams: Promise<{ tab?: string | string[]; cursor?: string | string[] }>;
}

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const { tab, cursor } = parseIncidentsSearchParams(await searchParams);
  const result = await getIncidentsQueue({ tab, pageSize: 20, ...(cursor ? { cursor } : {}) });

  return <IncidentsInbox result={result} tab={tab} {...(cursor ? { currentCursor: cursor } : {})} />;
}
