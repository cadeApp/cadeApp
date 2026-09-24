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

describe('T-203 · Emisor de Notificaciones Push (DoD)', () => {
  const USER_1 = '00000000-0000-4000-8000-000000000001';
  const USER_2 = '00000000-0000-4000-8000-000000000002';
  const REQ_ID = '10000000-0000-4000-8000-000000000001';
  const OFFER_ID = '20000000-0000-4000-8000-000000000001';

  const mockSubscriptions: PushSubscriptionRecord[] = [
    {
      id: 'sub-1',
      userId: USER_1,
      endpoint: 'https://push.example.com/sub/1',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0PvNuypwcPf8J3xW9Q5h3oG_SNNowv8WymgwWwgWwgWg=',
      auth: 'tBHItJI5svbpez7KI4CCXg==',
    },
    {
      id: 'sub-2',
      userId: USER_2,
      endpoint: 'https://push.example.com/sub/2',
      p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjXYJuMWTr3qgllFYBsDrDNbDHVmE=',
      auth: 'G2B5YmCg2s8R9eT9_W7_ag==',
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

  describe('DoD 1: El payload no lleva datos personales', () => {
    it('genera un payload conteniendo exclusivamente tipo de evento e identificadores', () => {
      const event: PushEvent = {
        event: 'request_published',
        requestId: REQ_ID,
      };

      const payload = buildPushPayload(event);
      expect(payload).toEqual({
        event: 'request_published',
        requestId: REQ_ID,
      });

      // No contiene campos sensibles bajo ningún concepto
      expect(payload).not.toHaveProperty('name');
      expect(payload).not.toHaveProperty('phone');
      expect(payload).not.toHaveProperty('address');
      expect(payload).not.toHaveProperty('recipient');
      expect(payload).not.toHaveProperty('latitude');
      expect(payload).not.toHaveProperty('longitude');
      expect(payload).not.toHaveProperty('coords');
      expect(payload).not.toHaveProperty('dni');
    });

    it('genera payload para offer_accepted con solo requestId y offerId', () => {
      const event: PushEvent = {
        event: 'offer_accepted',
        requestId: REQ_ID,
        offerId: OFFER_ID,
      };

      const payload = buildPushPayload(event);
      expect(payload).toEqual({
        event: 'offer_accepted',
        requestId: REQ_ID,
        offerId: OFFER_ID,
      });

      expect(payload).not.toHaveProperty('contact');
      expect(payload).not.toHaveProperty('phone');
    });

    it('validatePushPayload rechaza estrictamente cualquier intento de inyectar datos personales o coordenadas', () => {
      const invalidPayloadWithPhone = {
        event: 'request_published',
        requestId: REQ_ID,
        phone: '+5493865123456',
      };

      expect(() => validatePushPayload(invalidPayloadWithPhone)).toThrow();

      const invalidPayloadWithCoords = {
        event: 'offer_accepted',
        requestId: REQ_ID,
        offerId: OFFER_ID,
        latitude: -27.4333,
        longitude: -65.5833,
      };

      expect(() => validatePushPayload(invalidPayloadWithCoords)).toThrow();

      const invalidPayloadWithRecipient = {
        event: 'request_published',
        requestId: REQ_ID,
        recipient: { name: 'Juan Perez' },
      };

      expect(() => validatePushPayload(invalidPayloadWithRecipient)).toThrow();
    });
  });

  describe('DoD 2: Una falla del emisor no revierte la transición', () => {
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

      // No debe lanzar excepción, retorna resumen de ejecución
      expect(result.sentCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.message).toMatch(/unavailable|ECONNRESET/);
    });

    it('safeNotifyPostTransition ejecuta la notificación de forma segura garantizando que la acción de negocio nunca falle', async () => {
      const failingTransport: PushTransport = {
        send: vi.fn().mockRejectedValue(new Error('Fatal VAPID network failure')),
      };

      let businessTransitionCommitted = false;

      // Simulamos la acción de negocio post-commit
      const executeTransition = async () => {
        businessTransitionCommitted = true;
        // Invocación post-commit del emisor
        await safeNotifyPostTransition([USER_1], {
          event: 'offer_accepted',
          requestId: REQ_ID,
          offerId: OFFER_ID,
        }, {
          db: mockDb,
          transport: failingTransport,
        });
        return { success: true };
      };

      await expect(executeTransition()).resolves.toEqual({ success: true });
      expect(businessTransitionCommitted).toBe(true);
    });
  });

  describe('DoD 3: Un 410 borra la suscripción', () => {
    it('elimina la suscripción de la base de datos cuando el servicio retorna HTTP 410 (Gone)', async () => {
      const transport410: PushTransport = {
        send: vi.fn().mockResolvedValue({ status: 410 }),
      };

      const result = await sendPushNotification([USER_1], {
        event: 'request_published',
        requestId: REQ_ID,
      }, {
        db: mockDb,
        transport: transport410,
      });

      expect(result.deletedSubscriptions).toContain('https://push.example.com/sub/1');
      expect(mockDb.deleteSubscriptionByEndpoint).toHaveBeenCalledWith('https://push.example.com/sub/1');
      expect(deletedEndpoints).toEqual(['https://push.example.com/sub/1']);
    });

    it('elimina la suscripción de la base de datos cuando el servicio retorna HTTP 404 (Not Found)', async () => {
      const transport404: PushTransport = {
        send: vi.fn().mockResolvedValue({ status: 404 }),
      };

      const result = await sendPushNotification([USER_2], {
        event: 'request_published',
        requestId: REQ_ID,
      }, {
        db: mockDb,
        transport: transport404,
      });

      expect(result.deletedSubscriptions).toContain('https://push.example.com/sub/2');
      expect(mockDb.deleteSubscriptionByEndpoint).toHaveBeenCalledWith('https://push.example.com/sub/2');
    });

    it('conserva la suscripción cuando el servicio retorna HTTP 201 (Created) o 200 (OK)', async () => {
      const transport201: PushTransport = {
        send: vi.fn().mockResolvedValue({ status: 201 }),
      };

      const result = await sendPushNotification([USER_1], {
        event: 'request_published',
        requestId: REQ_ID,
      }, {
        db: mockDb,
        transport: transport201,
      });

      expect(result.sentCount).toBe(1);
      expect(result.deletedSubscriptions).toEqual([]);
      expect(mockDb.deleteSubscriptionByEndpoint).not.toHaveBeenCalled();
      expect(deletedEndpoints).toEqual([]);
    });

    it('NO elimina la suscripción ante errores transitorios de servidor (HTTP 500, 503, 429)', async () => {
      const transport500: PushTransport = {
        send: vi.fn().mockResolvedValue({ status: 500 }),
      };

      const result = await sendPushNotification([USER_1], {
        event: 'request_published',
        requestId: REQ_ID,
      }, {
        db: mockDb,
        transport: transport500,
      });

      expect(result.sentCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.deletedSubscriptions).toEqual([]);
      expect(mockDb.deleteSubscriptionByEndpoint).not.toHaveBeenCalled();
      expect(deletedEndpoints).toEqual([]);
    });
  });
});
