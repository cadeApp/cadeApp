import * as React from 'react';
import { AdminTripsList, getAdminTrips, parseAdminTripsSearchParams } from '@/features/admin-trips/server';

export const metadata = {
  title: 'Viajes | cadeApp Admin',
  description: 'Viajes de Aguilares con sus problemas: entregas no realizadas, cancelaciones e incidentes',
};

interface TripsPageProps {
  searchParams: Promise<{ filter?: string | string[]; cursor?: string | string[] }>;
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const { filter, cursor } = parseAdminTripsSearchParams(await searchParams);
  const result = await getAdminTrips({ filter, pageSize: 20, ...(cursor ? { cursor } : {}) });

  return <AdminTripsList result={result} filter={filter} {...(cursor ? { currentCursor: cursor } : {})} />;
}
