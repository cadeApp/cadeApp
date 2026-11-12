import * as React from 'react';
import { DisputeCandidates } from '@/features/admin';
import { getDisputeCandidates } from '@/features/admin/server';

export const metadata = {
  title: 'Disputas de DNI | cadeApp Admin',
  description: 'Búsqueda del titular real de un DNI reservado por otra cuenta',
};

interface DisputesPageProps {
  searchParams: Promise<{ q?: string }>;
}

/** CC-050 (D4-B): la búsqueda viaja por `?q=` y se resuelve en el servidor con la RPC (admin con aal2). */
export default async function DisputesPage({ searchParams }: DisputesPageProps): Promise<React.ReactElement> {
  const { q } = await searchParams;
  const lookup = typeof q === 'string' && q.trim().length > 0 ? q.trim() : null;
  const result = lookup ? await getDisputeCandidates(lookup) : null;

  return <DisputeCandidates lookup={lookup} result={result} />;
}
