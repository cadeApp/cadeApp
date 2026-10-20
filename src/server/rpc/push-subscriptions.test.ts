import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RPC_CONTRACTS } from '@/domain/rpc-contracts';
import type { SupabaseRpcCaller } from './offers';
import { registerPushSubscriptionRpc } from './push-subscriptions';

const MIGRATION = 'supabase/migrations/20261020123000_cc035_register_push_subscription.sql';
const SUBSCRIPTION_ID = '00000000-0000-4000-8000-0000000035d1';
const INPUT = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/cc035-endpoint-abc',
  p256dh: 'BKeyP256dh_valid-base64url',
  auth: 'AuthKey_valid-1',
  platform: 'web' as const,
};

function caller(response: { data: unknown; error: { message: string; code?: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(response);
  return { client: { rpc } as unknown as SupabaseRpcCaller, rpc };
}

describe('CC-035 · registerPushSubscriptionRpc (T-386)', () => {
  it('manda el payload jsonb con las claves exactas y devuelve la salida validada', async () => {
    const data = { subscriptionId: SUBSCRIPTION_ID, created: true, reassigned: false };
    const { client, rpc } = caller({ data, error: null });
    await expect(registerPushSubscriptionRpc(client, INPUT)).resolves.toEqual({ ok: true, data });
    expect(rpc).toHaveBeenCalledWith('register_push_subscription', {
      p_payload: {
        endpoint: INPUT.endpoint,
        p256dh: INPUT.p256dh,
        auth: INPUT.auth,
        platform: 'web',
      },
    });
  });

  it('sin platform manda null', async () => {
    const data = { subscriptionId: SUBSCRIPTION_ID, created: false, reassigned: true };
    const { client, rpc } = caller({ data, error: null });
    const { platform: _platform, ...withoutPlatform } = INPUT;
    await expect(registerPushSubscriptionRpc(client, withoutPlatform)).resolves.toEqual({ ok: true, data });
    expect(rpc).toHaveBeenCalledWith('register_push_subscription', {
      p_payload: { endpoint: INPUT.endpoint, p256dh: INPUT.p256dh, auth: INPUT.auth, platform: null },
    });
  });

  it('entrada inválida: VALIDATION_ERROR sin llamar a la RPC', async () => {
    const { client, rpc } = caller({ data: null, error: null });
    for (const input of [
      { ...INPUT, endpoint: 'http://insecure.test/x' },
      { ...INPUT, p256dh: 'no valida!' },
      { ...INPUT, auth: '' },
      { ...INPUT, platform: 'ios' },
    ]) {
      await expect(registerPushSubscriptionRpc(client, input)).resolves.toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
      });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('mapea los códigos del contrato, 42501 a UNAUTHORIZED_ACTOR y el resto a INTERNAL_ERROR', async () => {
    for (const code of ['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'VALIDATION_ERROR'] as const) {
      const { client } = caller({ data: null, error: { message: code, code: 'P0001' } });
      await expect(registerPushSubscriptionRpc(client, INPUT)).resolves.toEqual({ ok: false, code });
    }
    const denied = caller({ data: null, error: { message: 'permission denied for function', code: '42501' } });
    await expect(registerPushSubscriptionRpc(denied.client, INPUT)).resolves.toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    const unknown = caller({ data: null, error: { message: 'duplicate key value', code: '23505' } });
    await expect(registerPushSubscriptionRpc(unknown.client, INPUT)).resolves.toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('una salida que expone al dueño anterior o es inconsistente termina en INTERNAL_ERROR', async () => {
    const leaking = caller({
      data: { subscriptionId: SUBSCRIPTION_ID, created: false, reassigned: true, previousUserId: SUBSCRIPTION_ID },
      error: null,
    });
    await expect(registerPushSubscriptionRpc(leaking.client, INPUT)).resolves.toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
    const inconsistent = caller({
      data: { subscriptionId: SUBSCRIPTION_ID, created: true, reassigned: true },
      error: null,
    });
    await expect(registerPushSubscriptionRpc(inconsistent.client, INPUT)).resolves.toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('una excepción del cliente termina en INTERNAL_ERROR sin propagarse', async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error('network')) } as unknown as SupabaseRpcCaller;
    await expect(registerPushSubscriptionRpc(client, INPUT)).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });

  it('los códigos que levanta la migración coinciden con el contrato y los grants son los de CC-035', () => {
    const sql = fs.readFileSync(path.resolve(process.cwd(), MIGRATION), 'utf8');
    const raised = new Set([...sql.matchAll(/message = '([A-Z0-9_]+)'/g)].map((m) => m[1] ?? ''));
    // INTERNAL_ERROR lo pone el wrapper (errores de infraestructura), no el SQL.
    raised.add('INTERNAL_ERROR');
    expect([...raised].sort()).toEqual([...RPC_CONTRACTS.register_push_subscription.errorCodes].sort());
    expect(sql).toMatch(/security definer\s+set search_path = public, pg_temp/i);
    expect(sql).toMatch(
      /revoke all on function public\.register_push_subscription\(jsonb\) from public, anon, authenticated;/i
    );
    expect(sql).toMatch(/grant execute on function public\.register_push_subscription\(jsonb\) to authenticated;/i);
    // La auditoría nunca guarda el endpoint ni las claves.
    const auditInsert = sql.match(/insert into public\.audit_log[\s\S]*?\);/i)?.[0] ?? '';
    expect(auditInsert).toContain('push_subscription_reassigned');
    expect(auditInsert).not.toMatch(/endpoint|p256dh|auth_key/i);
  });
});
