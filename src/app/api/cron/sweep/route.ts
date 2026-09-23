import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/server/env';
import { runSweep } from '@/server/cron/sweep';

async function handleSweep(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedAuth = `Bearer ${serverEnv.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const swept = await runSweep();
    return NextResponse.json({ ok: true, swept });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleSweep(req);
}

export async function POST(req: NextRequest) {
  return handleSweep(req);
}
