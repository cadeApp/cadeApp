import * as React from 'react';
import { redirect } from 'next/navigation';
import { legacyIncidentsTabRedirect } from '@/features/incidents';
import {
  getIncidentsQueue,
  getIncidentTabCounts,
  IncidentsInbox,
  parseIncidentsSearchParams,
} from '@/features/incidents/server';

export const metadata = {
  title: 'Incidentes | cadeApp Admin',
  description: 'Reclamos de comercios y repartidores de Aguilares para mediar y resolver',
};

interface IncidentsPageProps {
  searchParams: Promise<{ tab?: string | string[]; cursor?: string | string[] }>;
}

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const raw = await searchParams;
  const legacyHref = legacyIncidentsTabRedirect(raw);
  if (legacyHref) redirect(legacyHref);

  const { tab, cursor } = parseIncidentsSearchParams(raw);
  const [result, counts] = await Promise.all([
    getIncidentsQueue({ tab, pageSize: 20, ...(cursor ? { cursor } : {}) }),
    getIncidentTabCounts(),
  ]);

  return (
    <IncidentsInbox result={result} tab={tab} counts={counts} {...(cursor ? { currentCursor: cursor } : {})} />
  );
}
