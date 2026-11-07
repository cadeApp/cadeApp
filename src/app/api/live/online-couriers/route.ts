import { NextResponse } from 'next/server';
import { getOnlineCouriersLiveServer } from '@/server/live/online-couriers';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

/** CC-041 (T-415): repartidores conectados ahora, solo el conteo, para el comercio autenticado. */
export async function GET() {
  const result = await getOnlineCouriersLiveServer();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_CACHE_HEADERS });
  }
  return NextResponse.json(result.data, { status: 200, headers: NO_CACHE_HEADERS });
}
