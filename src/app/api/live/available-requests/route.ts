import { NextResponse, type NextRequest } from 'next/server';
import { getAvailableRequestsLiveServer } from '@/server/live/t204';
import { livePageCursorSchema, type LivePageCursor } from '@/lib/live-contracts';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function GET(request?: NextRequest | Request) {
  const url = request?.url ? new URL(request.url) : null;
  const cursorCreatedAt = url?.searchParams.get('cursorCreatedAt') ?? null;
  const cursorId = url?.searchParams.get('cursorId') ?? null;

  let cursor: LivePageCursor | null = null;
  if (cursorCreatedAt || cursorId) {
    if (!cursorCreatedAt || !cursorId) {
      return NextResponse.json(
        { error: 'INVALID_CURSOR' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    const parsed = livePageCursorSchema.safeParse({
      createdAt: cursorCreatedAt,
      id: cursorId,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'INVALID_CURSOR' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    cursor = parsed.data;
  }

  const result = await getAvailableRequestsLiveServer(cursor);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      {
        status: result.status,
        headers: NO_CACHE_HEADERS,
      }
    );
  }

  return NextResponse.json(result.data, {
    status: 200,
    headers: NO_CACHE_HEADERS,
  });
}

