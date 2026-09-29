import { NextResponse, type NextRequest } from 'next/server';
import { getTripLiveStateServer } from '@/server/live/t204';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const result = await getTripLiveStateServer(tripId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      {
        status: result.status,
        headers: NO_CACHE_HEADERS,
      }
    );
  }

  return NextResponse.json(
    { data: result.data },
    {
      status: 200,
      headers: NO_CACHE_HEADERS,
    }
  );
}
