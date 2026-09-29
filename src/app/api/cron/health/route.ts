import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/server/env';
import { checkUptimeHealth } from '@/server/observability';

export const runtime = 'nodejs';

async function handleHealthCron(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedAuth = `Bearer ${serverEnv.CRON_SECRET}`;

  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeaderBuf = Buffer.from(authHeader);
  const expectedAuthBuf = Buffer.from(expectedAuth);

  if (
    authHeaderBuf.length !== expectedAuthBuf.length ||
    !crypto.timingSafeEqual(authHeaderBuf, expectedAuthBuf)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'http://localhost:3000';
    const result = await checkUptimeHealth(baseUrl);

    if (!result.healthy) {
      return NextResponse.json({ ok: false, result }, { status: 503 });
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal Error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleHealthCron(req);
}

export async function POST(req: NextRequest) {
  return handleHealthCron(req);
}
