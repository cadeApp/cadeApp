import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverEnv } from '@/server/env';
import { sendPushNotification, pushPayloadSchema } from '@/server/push/sender';

export const runtime = 'nodejs';

const sendPushRouteSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  event: pushPayloadSchema,
});

export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const parsed = sendPushRouteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userIds, event } = parsed.data;
    const result = await sendPushNotification(userIds, event);

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[Push Route] Internal error sending notification:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
