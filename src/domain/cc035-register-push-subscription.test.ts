import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import { type FakePlatformSettings, createFakeRpcClient } from './testing/rpc-fake';

const SETTINGS: FakePlatformSettings = {
  minOfferArs: 1200,
  maxOffersPerMin: 10,
  maxRequestPublicationsPerMin: 10,
  maxIncidentsPerMin: 5,
  requestTtlMinutes: 25,
  pilotActive: true,
  pilotTermsVersion: 'v1.0',
  subscriptionGraceDays: 3,
};

const MERCHANT_ID = '10000000-0000-4000-8000-0000000035b1';
const COURIER_ID = '20000000-0000-4000-8000-0000000035c1';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/cc035-endpoint-abc';
const KEYS = { p256dh: 'BKeyP256dh_valid-base64url', auth: 'AuthKey_valid-1' };

function fake() {
  return createFakeRpcClient({
    settings: SETTINGS,
    initialActor: { userId: MERCHANT_ID, role: 'merchant', consentStatus: 'active' },
  });
}

describe('CC-035 — register_push_subscription', () => {
  it('está registrada en los contratos con sus códigos de error', () => {
    expect(ALL_RPC_NAMES).toContain('register_push_subscription');
    expect(RPC_CONTRACTS.register_push_subscription.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ]);
  });

  it('inputSchema exige endpoint https de hasta 2048, claves base64url de hasta 256 y platform web o nula', () => {
    const schema = RPC_CONTRACTS.register_push_subscription.inputSchema;
    expect(schema.safeParse({ endpoint: ENDPOINT, ...KEYS, platform: 'web' }).success).toBe(true);
    expect(schema.safeParse({ endpoint: ENDPOINT, ...KEYS }).success).toBe(true);
    expect(schema.safeParse({ endpoint: ENDPOINT, ...KEYS, platform: null }).success).toBe(true);
    expect(schema.safeParse({ endpoint: 'http://insecure.test/x', ...KEYS }).success).toBe(false);
    expect(
      schema.safeParse({ endpoint: `https://push.test/${'x'.repeat(2048)}`, ...KEYS }).success
    ).toBe(false);
    expect(schema.safeParse({ endpoint: ENDPOINT, p256dh: 'no valida!', auth: KEYS.auth }).success).toBe(false);
    expect(schema.safeParse({ endpoint: ENDPOINT, p256dh: KEYS.p256dh, auth: 'a'.repeat(257) }).success).toBe(false);
    expect(schema.safeParse({ endpoint: ENDPOINT, p256dh: '', auth: KEYS.auth }).success).toBe(false);
    expect(schema.safeParse({ endpoint: ENDPOINT, ...KEYS, platform: 'ios' }).success).toBe(false);
  });

  it('outputSchema no admite created y reassigned a la vez ni campos del dueño anterior', () => {
    const schema = RPC_CONTRACTS.register_push_subscription.outputSchema;
    const id = '00000000-0000-4000-8000-0000000035d1';
    expect(schema.safeParse({ subscriptionId: id, created: true, reassigned: false }).success).toBe(true);
    expect(schema.safeParse({ subscriptionId: id, created: false, reassigned: true }).success).toBe(true);
    expect(schema.safeParse({ subscriptionId: id, created: true, reassigned: true }).success).toBe(false);
    expect(
      schema.safeParse({ subscriptionId: id, created: false, reassigned: true, previousUserId: MERCHANT_ID }).success
    ).toBe(false);
  });

  it('fake: alta nueva, reintento sin duplicar y reasignación a la cuenta actual', async () => {
    const client = fake();

    const created = await client.register_push_subscription({ endpoint: ENDPOINT, ...KEYS, platform: 'web' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data).toMatchObject({ created: true, reassigned: false });
    expect(client.getPushSubscription(ENDPOINT)?.userId).toBe(MERCHANT_ID);

    const retried = await client.register_push_subscription({ endpoint: ENDPOINT, ...KEYS, platform: 'web' });
    expect(retried).toEqual({
      ok: true,
      data: { subscriptionId: created.data.subscriptionId, created: false, reassigned: false },
    });

    client.setActor({ userId: COURIER_ID, role: 'courier', consentStatus: 'active' });
    const reassigned = await client.register_push_subscription({
      endpoint: ENDPOINT,
      p256dh: 'OtraClaveP256dh',
      auth: 'OtraAuth',
    });
    expect(reassigned).toEqual({
      ok: true,
      data: { subscriptionId: created.data.subscriptionId, created: false, reassigned: true },
    });
    expect(client.getPushSubscription(ENDPOINT)).toMatchObject({
      userId: COURIER_ID,
      p256dh: 'OtraClaveP256dh',
      auth: 'OtraAuth',
    });
  });

  it('fake: sin sesión, sin consentimiento activo y entrada inválida', async () => {
    const client = fake();

    client.setActor({ userId: MERCHANT_ID, role: 'merchant', consentStatus: 'pending' });
    expect(await client.register_push_subscription({ endpoint: ENDPOINT, ...KEYS })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    expect(client.getPushSubscription(ENDPOINT)).toBeUndefined();

    client.setActor({ userId: MERCHANT_ID, role: 'merchant', consentStatus: 'active' });
    expect(await client.register_push_subscription({ endpoint: 'http://x.test', ...KEYS })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    client.setActor({ userId: '', role: null });
    expect(await client.register_push_subscription({ endpoint: ENDPOINT, ...KEYS })).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
    });
  });

  it('fake: el admin registra aunque su consentimiento no esté activo (misma regla que la policy)', async () => {
    const client = fake();
    client.setActor({ userId: '30000000-0000-4000-8000-0000000035a1', role: 'admin', consentStatus: 'pending' });
    const result = await client.register_push_subscription({ endpoint: ENDPOINT, ...KEYS });
    expect(result.ok).toBe(true);
  });
});
