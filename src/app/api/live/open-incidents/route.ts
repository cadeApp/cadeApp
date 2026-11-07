import { NextResponse } from 'next/server';
import { getServerSession } from '@/features/auth/server';
import { getOpenIncidentsCount } from '@/features/incidents/server';
import type { LiveOpenIncidentsResponse } from '@/lib/live-contracts';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

/**
 * T-406 (D01 = C): incidentes abiertos para el contador de la navegación admin. Solo admin con aal2: la RLS dejaría a
 * quien reportó contar sus propios incidentes, y ese número no le corresponde.
 */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: NO_CACHE_HEADERS });
  }
  if (session.role !== 'admin' || session.aal !== 'aal2') {
    return NextResponse.json({ error: 'UNAUTHORIZED_ACTOR' }, { status: 403, headers: NO_CACHE_HEADERS });
  }
  const count = await getOpenIncidentsCount();
  if (count === null) {
    return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
  const body: LiveOpenIncidentsResponse = { count };
  return NextResponse.json(body, { status: 200, headers: NO_CACHE_HEADERS });
}
