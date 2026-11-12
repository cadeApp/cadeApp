import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPushPayload,
  validatePushPayload,
  sendPushNotification,
  safeNotifyPostTransition,
  type PushEvent,
  type PushSubscriptionRecord,
  type PushTransport,
  type PushDatabaseClient,
} from './sender';

vi.mock('@/server/env', () => ({
  serverEnv: {
    VAPID_PRIVATE_KEY: 'test-private-key',
    VAPID_SUBJECT: 'mailto:test@cadeapp.com',
  },
}));

vi.mock('@/lib/env.public', () => ({
  publicEnv: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'test-public-key',
  },
}));

describe('T-203 · Emisor de Notificaciones Push (DoD)', () => {
  const USER_1 = '00000000-0000-4000-8000-000000000001';
  const USER_2 = '00000000-0000-4000-8000-000000000002';
  const REQ_ID = '10000000-0000-4000-8000-000000000001';
  const OFFER_ID = '20000000-0000-4000-8000-000000000001';

  const mockSubscriptions: PushSubscriptionRecord[] = [
    {
      id: 'sub-1',
      userId: USER_1,
      endpoint: 'https://fcm.googleapis.com/fcm/send/sub/1',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0PvNuypwcPf8J3xW9Q5h3oG_SNNowv8WymgwWwgWwgWg=',
      auth: 'tBHItJI5svbpez7KI4CCXg==',
      platform: 'web',
    },
    {
      id: 'sub-2',
      userId: USER_2,
      endpoint: 'https://fcm.googleapis.com/fcm/send/sub/2',
      p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjXYJuMWTr3qgllFYBsDrDNbDHVmE=',
      auth: 'G2B5YmCg2s8R9eT9_W7_ag==',
      platform: 'android',
    },
  ];

  let deletedEndpoints: string[];
  let mockDb: PushDatabaseClient;
  let mockTransport: PushTransport;

  beforeEach(() => {
    deletedEndpoints = [];
    mockDb = {
      getSubscriptionsForUsers: vi.fn(async (userIds: string[]) => {
        return mockSubscriptions.filter((s) => userIds.includes(s.userId));
      }),
      deleteSubscriptionByEndpoint: vi.fn(async (endpoint: string) => {
        deletedEndpoints.push(endpoint);
      }),
    };

    mockTransport = {
      send: vi.fn(async () => ({ status: 201 })),
    };
  });

  describe('PR91-H04 / DoD 1: El payload no lleva datos personales en ninguna variante', () => {
    const PUSH_EVENT_VARIANTS: PushEvent[] = [
      { event: 'request_published', requestId: REQ_ID },
      { event: 'offer_submitted', requestId: REQ_ID, offerId: OFFER_ID },
      { event: 'offer_accepted', requestId: REQ_ID, offerId: OFFER_ID },
      { event: 'request_cancelled', requestId: REQ_ID },
      { event: 'request_expired', requestId: REQ_ID },
    ];

    const SENTINEL_PII = {
      recipient_name: 'Juan Perez',
      recipient_phone: '+5493865123456',
      recipient_address: 'Av. San Martin 123',
      recipient_notes: 'Piso 2 Depto B',
      latitude: -27.4333,
      longitude: -65.5833,
      dni: '12345678',
    };

    it.each(PUSH_EVENT_VARIANTS)(
      'genera payload estricto para variante "$event" sin campos sensibles',
      (event) => {
        const payload = buildPushPayload(event);
        expect(payload).toEqual(event);

        // Ninguna clave sensible está presente
        expect(payload).not.toHaveProperty('name');
        expect(payload).not.toHaveProperty('phone');
        expect(payload).not.toHaveProperty('address');
        expect(payload).not.toHaveProperty('recipient');
        expect(payload).not.toHaveProperty('latitude');
        expect(payload).not.toHaveProperty('longitude');
        expect(payload).not.toHaveProperty('dni');
      }
    );

    it.each(PUSH_EVENT_VARIANTS)(
      'rechaza estrictamente la inyección de SENTINEL_PII en la variante "$event"',
      (event) => {
        const contaminated = {
          ...event,
          ...SENTINEL_PII,
        };

        expect(() => validatePushPayload(contaminated)).toThrow();
      }
    );

    it.each(PUSH_EVENT_VARIANTS)(
      'rechaza un extra field individual (phone) en la variante "$event"',
      (event) => {
        const withExtra = {
          ...event,
          phone: '+5493865123456',
        };

        expect(() => validatePushPayload(withExtra)).toThrow();
      }
    );
  });

  describe('PR91-H02 / DoD 2: Una falla del emisor no revierte la transición (safeNotifyPostTransition)', () => {
    it('sendPushNotification aísla excepciones del transporte y retorna resultado sin propagar error', async () => {
      const failingTransport: PushTransport = {
        send: vi.fn().mockRejectedValue(new Error('Push service unavailable / ECONNRESET')),
      };

      const result = await sendPushNotification([USER_1], {
        event: 'request_published',
        requestId: REQ_ID,
      }, {
        db: mockDb,
        transport: failingTransport,
      });

      // No debe lanzar excepción, retorna resumen de ejecución con intentos
      expect(result.sentCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.message).toMatch(/unavailable|ECONNRESET/);
      expect(result.attempts).toEqual([
        {
          outcome: 'sent',
          endpoint: 'https://fcm.googleapis.com/fcm/send/sub/1',
          status: 500,
          error: expect.stringMatching(/unavailable|ECONNRESET/),
        },
      ]);
    });

    it('safeNotifyPostTransition invoca positivamente al transporte y garantiza que la transición de negocio nunca falle', async () => {
      const failingTransport: PushTransport = {
        send: vi.fn().mockRejectedValue(new Error('Fatal VAPID network failure')),
      };

      let businessTransitionCommitted = false;

      // Simulamos la acción de negocio post-commit
      const executeTransition = async () => {
        businessTransitionCommitted = true;
        // Invocación post-commit del emisor
        const notifyResult = await safeNotifyPostTransition([USER_1], {
          event: 'offer_accepted',
          requestId: REQ_ID,
          offerId: OFFER_ID,
        }, {
          db: mockDb,
          transport: failingTransport,
        });

        // Aserción del despacho técnico
        expect(notifyResult.sentCount).toBe(0);
        expect(notifyResult.failedCount).toBe(1);

        return { success: true };
      };

      const result = await executeTransition();

      // 1. Aserción POSITIVA: el transporte fue efectivamente invocado
      expect(failingTransport.send).toHaveBeenCalledTimes(1);

      // 2. Aserción de negocio: la transición completó sin rollback
      expect(result).toEqual({ success: true });
      expect(businessTransitionCommitted).toBe(true);
    });

    it('safeNotifyPostTransition en caso exitoso invoca al transporte con el payload esperado', async () => {
      let businessTransitionCommitted = false;

      const executeTransition = async () => {
        businessTransitionCommitted = true;
        const notifyResult = await safeNotifyPostTransition([USER_1], {
          event: 'request_published',
          requestId: REQ_ID,
        }, {
          db: mockDb,
          transport: mockTransport,
        });

        expect(notifyResult.sentCount).toBe(1);
        expect(notifyResult.failedCount).toBe(0);
        expect(notifyResult.attempts[0]?.status).toBe(201);
        return { success: true, id: REQ_ID };
      };

      const result = await executeTransition();
      expect(mockTransport.send).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true, id: REQ_ID });
      expect(businessTransitionCommitted).toBe(true);
    });
  });

  // PR91-H03 y PR91-H08 (adaptador y VAPID) pasaron a transport.test.ts: con CC-049 (D4-B) el transporte ya no usa
  // web-push.sendNotification y se prueba contra un servidor local.

  describe('CC-049: el emisor aplica la allowlist (E01–E19)', () => {
    const CASES: ReadonlyArray<readonly [string, string, boolean]> = [
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

    it.each(CASES)('%s %s → enviado: %s', async (_id, endpoint, allowed) => {
      const db: PushDatabaseClient = {
        getSubscriptionsForUsers: vi.fn().mockResolvedValue([
          { id: 'sub-x', userId: USER_1, endpoint, p256dh: 'k', auth: 'a' },
        ]),
        deleteSubscriptionByEndpoint: vi.fn(),
      };
      const transport: PushTransport = { send: vi.fn().mockResolvedValue({ status: 201 }) };

      const result = await sendPushNotification([USER_1], { event: 'request_published', requestId: REQ_ID }, {
        db,
        transport,
      });

      expect(result.attempts).toHaveLength(1);
      const attempt = result.attempts[0]!;
      if (allowed) {
        expect(transport.send).toHaveBeenCalledTimes(1);
        expect(attempt).toEqual({ outcome: 'sent', endpoint, status: 201 });
        expect(result.sentCount).toBe(1);
      } else {
        expect(transport.send).not.toHaveBeenCalled();
        expect(attempt).toEqual({ outcome: 'blocked', status: 0, error: 'ENDPOINT_NOT_ALLOWED' });
        expect(Object.hasOwn(attempt, 'endpoint')).toBe(false);
        expect(result.failedCount).toBe(1);
        expect(db.deleteSubscriptionByEndpoint).not.toHaveBeenCalled();
      }
    });
  });

  describe('PR91-H05: Parametrización exhaustiva de códigos HTTP', () => {
    it.each([200, 201])(
      'cuenta HTTP %i como éxito, no borra la suscripción y registra el status en attempts',
      async (status) => {
        const transport: PushTransport = {
          send: vi.fn().mockResolvedValue({ status }),
        };

        const result = await sendPushNotification([USER_1], {
          event: 'request_published',
          requestId: REQ_ID,
        }, {
          db: mockDb,
          transport,
        });

        expect(result.sentCount).toBe(1);
        expect(result.failedCount).toBe(0);
        expect(result.deletedSubscriptions).toEqual([]);
        expect(mockDb.deleteSubscriptionByEndpoint).not.toHaveBeenCalled();
        expect(deletedEndpoints).toEqual([]);
        expect(result.attempts).toEqual([
          { outcome: 'sent', endpoint: 'https://fcm.googleapis.com/fcm/send/sub/1', status },
        ]);
      }
    );

    it.each([404, 410])(
      'trata HTTP %i como baja, elimina la suscripción de la base de datos y la registra en deletedSubscriptions',
      async (status) => {
        const transport: PushTransport = {
          send: vi.fn().mockResolvedValue({ status }),
        };

        const result = await sendPushNotification([USER_1], {
          event: 'request_published',
          requestId: REQ_ID,
        }, {
          db: mockDb,
          transport,
        });

        expect(result.sentCount).toBe(0);
        expect(result.failedCount).toBe(1);
        expect(result.deletedSubscriptions).toContain('https://fcm.googleapis.com/fcm/send/sub/1');
        expect(mockDb.deleteSubscriptionByEndpoint).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/sub/1');
        expect(deletedEndpoints).toEqual(['https://fcm.googleapis.com/fcm/send/sub/1']);
        expect(result.attempts).toEqual([
          { outcome: 'sent', endpoint: 'https://fcm.googleapis.com/fcm/send/sub/1', status },
        ]);
      }
    );

    // CC-049 (PR698-H02): un 3xx no se sigue ni cuenta como envío.
    it.each([300, 302, 399, 429, 500, 503])(
      'trata HTTP %i como falla sin baja, NO elimina la suscripción válida y registra el status',
      async (status) => {
        const transport: PushTransport = {
          send: vi.fn().mockResolvedValue({ status }),
        };

        const result = await sendPushNotification([USER_1], {
          event: 'request_published',
          requestId: REQ_ID,
        }, {
          db: mockDb,
          transport,
        });

        expect(result.sentCount).toBe(0);
        expect(result.failedCount).toBe(1);
        expect(result.deletedSubscriptions).toEqual([]);
        expect(mockDb.deleteSubscriptionByEndpoint).not.toHaveBeenCalled();
        expect(deletedEndpoints).toEqual([]);
        expect(result.attempts).toEqual([
          { outcome: 'sent', endpoint: 'https://fcm.googleapis.com/fcm/send/sub/1', status },
        ]);
      }
    );
  });

  describe('Casos de borde y componentes de infraestructura', () => {
    it('retorna resultado vacío inmediatamente si userIds es un arreglo vacío', async () => {
      const result = await sendPushNotification([], {
        event: 'request_published',
        requestId: REQ_ID,
      }, {
        db: mockDb,
        transport: mockTransport,
      });

      expect(result.totalSubscriptions).toBe(0);
      expect(result.sentCount).toBe(0);
      expect(result.attempts).toEqual([]);
      expect(mockDb.getSubscriptionsForUsers).not.toHaveBeenCalled();
    });

    it('captura fallas al consultar la base de datos sin lanzar excepción', async () => {
      const failingDb: PushDatabaseClient = {
        getSubscriptionsForUsers: vi.fn().mockRejectedValue(new Error('Supabase database error')),
        deleteSubscriptionByEndpoint: vi.fn(),
      };

      const result = await sendPushNotification([USER_1], {
        event: 'request_published',
        requestId: REQ_ID,
      }, {
        db: failingDb,
        transport: mockTransport,
      });

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.message).toContain('Supabase database error');
    });

    it('captura fallas al eliminar suscripciones sin interrumpir el proceso', async () => {
      const transport410: PushTransport = {
        send: vi.fn().mockResolvedValue({ status: 410 }),
      };

      const failingDeleteDb: PushDatabaseClient = {
        getSubscriptionsForUsers: vi.fn().mockResolvedValue(mockSubscriptions.slice(0, 1)),
        deleteSubscriptionByEndpoint: vi.fn().mockRejectedValue(new Error('Delete error in database')),
      };

      const result = await sendPushNotification([USER_1], {
        event: 'request_published',
        requestId: REQ_ID,
      }, {
        db: failingDeleteDb,
        transport: transport410,
      });

      expect(result.failedCount).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.message).toContain('Delete error in database');
    });
  });
});
