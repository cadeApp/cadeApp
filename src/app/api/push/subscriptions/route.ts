import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { RpcErrorCode } from '@/domain';
import { registerPushSubscriptionRpc } from '@/server/rpc/push-subscriptions';
import { createClient } from '@/server/supabase/server';

export const runtime = 'nodejs';

const registerSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  platform: z.string().optional(),
});

function registerErrorResponse(code: RpcErrorCode<'register_push_subscription'>) {
  switch (code) {
    case 'UNAUTHENTICATED':
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    case 'VALIDATION_ERROR':
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    case 'UNAUTHORIZED_ACTOR':
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    default:
      return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

const deleteSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = registerSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // CC-035: la RPC registra el endpoint para la cuenta logueada y, si era de otra cuenta, lo reasigna.
    // Nunca se loguea el endpoint ni las claves (AGENTS.md §2).
    const result = await registerPushSubscriptionRpc(supabase, parsed.data);
    if (!result.ok) {
      return registerErrorResponse(result.code);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = deleteSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { endpoint } = parsed.data;

    const { error: dbError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id);

    if (dbError) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
