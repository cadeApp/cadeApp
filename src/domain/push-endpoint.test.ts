import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from './push-endpoint';
import { RPC_CONTRACTS } from './rpc-contracts';
import { createFakeRpcClient } from './testing/rpc-fake';

// CC-049 §Impacto exacto, tabla canónica E01–E19: pares literales con el esperado fijo.
const CC049_ENDPOINT_CASES: ReadonlyArray<readonly [id: string, endpoint: string, expected: boolean]> = [
  ['E01', 'https://fcm.googleapis.com/fcm/send/abc', true],
  ['E02', 'https://updates.push.services.mozilla.com/wpush/v2/abc', true],
  ['E03', 'https://web.push.apple.com/QAbc', true],
  ['E04', 'https://wns2-par02p.notify.windows.com/w/?token=abc', true],
  ['E05', 'https://FCM.GoogleAPIs.com/fcm/send/abc', true],
  ['E06', 'https://fcm.googleapis.com:443/fcm/send/abc', true],
  ['E07', 'http://fcm.googleapis.com/fcm/send/abc', false],
  ['E08', 'https://push.example.com/abc', false],
  ['E09', 'https://fcm.googleapis.com.evil.example/abc', false],
  ['E10', 'https://fcm.googleapis.com@evil.example/abc', false],
  ['E11', 'https://fcm.googleapis.com:8443/fcm/send/abc', false],
  ['E12', 'https://fcm.googleapis.com\\evil.example/abc', false],
  ['E13', 'https://fcm.googleapis.com./fcm/send/abc', false],
  ['E14', 'https://fcm%2egoogleapis.com/fcm/send/abc', false],
  ['E15', 'https://[2001:db8::1]/fcm/send/abc', false],
  ['E16', 'https://fcm.googleapis.com', false],
  ['E17', 'https://notify.windows.com/w/?token=abc', false],
  ['E18', 'https://a.b.notify.windows.com/w/?token=abc', false],
  ['E19', 'https://evilnotify.windows.com/w/?token=abc', false],
];

describe('CC-049 — isAllowedPushEndpoint (E01–E19)', () => {
  it('la tabla tiene los 19 casos con ids únicos y E12 lleva una sola barra invertida', () => {
    expect(CC049_ENDPOINT_CASES).toHaveLength(19);
    expect(new Set(CC049_ENDPOINT_CASES.map(([id]) => id)).size).toBe(19);
    expect(CC049_ENDPOINT_CASES[11]?.[1].split('\\')).toHaveLength(2);
  });

  it.each(CC049_ENDPOINT_CASES)('%s %s → %s', (_id, endpoint, expected) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(expected);
  });
});

const KEYS = { p256dh: 'BKeyP256dh_valid-base64url', auth: 'AuthKey_valid-1' };

describe('CC-049 — register_push_subscription aplica la allowlist (E01–E19)', () => {
  it.each(CC049_ENDPOINT_CASES)('inputSchema %s → %s', (_id, endpoint, expected) => {
    const schema = RPC_CONTRACTS.register_push_subscription.inputSchema;
    expect(schema.safeParse({ endpoint, ...KEYS }).success).toBe(expected);
  });

  it.each(CC049_ENDPOINT_CASES)('fake %s → %s', async (_id, endpoint, expected) => {
    const client = createFakeRpcClient({
      settings: {
        minOfferArs: 1200,
        maxOffersPerMin: 10,
        maxRequestPublicationsPerMin: 10,
        maxIncidentsPerMin: 5,
        requestTtlMinutes: 25,
        pilotActive: true,
        pilotTermsVersion: 'v1.0',
        subscriptionGraceDays: 3,
      },
      initialActor: { userId: '10000000-0000-4000-8000-0000000049b1', role: 'merchant', consentStatus: 'active' },
    });
    const result = await client.register_push_subscription({ endpoint, ...KEYS });
    if (expected) {
      expect(result.ok).toBe(true);
    } else {
      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      expect(client.getPushSubscription(endpoint)).toBeUndefined();
    }
  });
});
