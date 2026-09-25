import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/server/env';
import { runSweep } from '@/server/cron/sweep';
import { sendCriticalAlert } from '@/server/observability';

export const runtime = 'nodejs';

async function handleSweep(req: NextRequest) {
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
    const swept = await runSweep();
    return NextResponse.json({ ok: true, swept });
  } catch (error) {
    await sendCriticalAlert({
      type: 'cron_sweep_failed',
      severity: 'critical',
      message: `Fallo crítico en ejecución de cron sweep: ${error instanceof Error ? error.message : String(error)}`,
      details: {
        error: error instanceof Error ? error.stack : String(error),
      },
    });
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleSweep(req);
}

export async function POST(req: NextRequest) {
  return handleSweep(req);
}
