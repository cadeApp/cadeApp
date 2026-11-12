// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { sendPushNotification } from '@/server/push/sender';

// T-433 (SEC-08): la ruta se autoriza con PUSH_SEND_SECRET, distinta de CRON_SECRET.
const CRON_SECRET = 'test-cron-secret-0123456789abcdef';
const PUSH_SEND_SECRET = 'test-push-send-secret-0123456789ab';
const mockEnv: { CRON_SECRET: string; PUSH_SEND_SECRET: string | undefined } = { CRON_SECRET, PUSH_SEND_SECRET };

vi.mock('@/server/env', () => ({
  serverEnv: new Proxy({}, { get: (_t, prop: string) => mockEnv[prop as keyof typeof mockEnv] }),
}));

vi.mock('@/server/push/sender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/push/sender')>();
  return {
    ...actual,
    sendPushNotification: vi.fn(),
  };
});


describe('POST /api/push/send', () => {
  const USER_ID = '00000000-0000-4000-8000-000000000001';
  const REQ_ID = '10000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.PUSH_SEND_SECRET = PUSH_SEND_SECRET;
  });

  const validBody = () =>
    JSON.stringify({ userIds: [USER_ID], event: { event: 'request_published', requestId: REQ_ID } });

  it('SEC-08: el Bearer de CRON_SECRET ya no autoriza el envío de push', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
      body: validBody(),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it.each([`Bearer ${CRON_SECRET}`, 'Bearer ', 'Bearer undefined'])(
    'SEC-08: sin PUSH_SEND_SECRET configurada, el header %j no autoriza',
    async (authorization) => {
      mockEnv.PUSH_SEND_SECRET = undefined;
      const req = new NextRequest('http://localhost:3000/api/push/send', {
        method: 'POST',
        headers: { authorization },
        body: validBody(),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      expect(sendPushNotification).not.toHaveBeenCalled();
    }
  );

  it('responde 401 si no se envía la cabecera Authorization', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/send', {
      method: 'POST',
      body: JSON.stringify({
        userIds: [USER_ID],
        event: { event: 'request_published', requestId: REQ_ID },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('responde 401 si el token de autorización es incorrecto', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-invalido',
      },
      body: JSON.stringify({
        userIds: [USER_ID],
        event: { event: 'request_published', requestId: REQ_ID },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('responde 400 si el payload contiene datos prohibidos o IDs inválidos', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${PUSH_SEND_SECRET}`,
      },
      body: JSON.stringify({
        userIds: ['not-a-uuid'],
        event: { event: 'request_published', requestId: REQ_ID, phone: '+5493865123456' },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid payload');
  });

  it('responde 200 y ejecuta sendPushNotification cuando la autorización y el payload son válidos', async () => {
    vi.mocked(sendPushNotification).mockResolvedValue({
      totalSubscriptions: 1,
      sentCount: 1,
      failedCount: 0,
      deletedSubscriptions: [],
      attempts: [{ outcome: 'sent', endpoint: 'https://fcm.googleapis.com/fcm/send/sub/1', status: 201 }],
      errors: [],
    });

    const req = new NextRequest('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${PUSH_SEND_SECRET}`,
      },
      body: JSON.stringify({
        userIds: [USER_ID],
        event: { event: 'request_published', requestId: REQ_ID },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.result.sentCount).toBe(1);

    expect(sendPushNotification).toHaveBeenCalledWith([USER_ID], {
      event: 'request_published',
      requestId: REQ_ID,
    });
  });
  it('CC-049 (PR698-H01): un intento bloqueado llega al JSON sin la propiedad endpoint', async () => {
    vi.mocked(sendPushNotification).mockResolvedValue({
      totalSubscriptions: 2,
      sentCount: 1,
      failedCount: 1,
      deletedSubscriptions: [],
      attempts: [
        { outcome: 'sent', endpoint: 'https://fcm.googleapis.com/fcm/send/sub/1', status: 201 },
        { outcome: 'blocked', status: 0, error: 'ENDPOINT_NOT_ALLOWED' },
      ],
      errors: [],
    });

    const req = new NextRequest('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${PUSH_SEND_SECRET}` },
      body: JSON.stringify({
        userIds: [USER_ID],
        event: { event: 'request_published', requestId: REQ_ID },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.sentCount).toBe(1);
    expect(json.result.failedCount).toBe(1);
    expect(JSON.stringify(json)).not.toContain('push.example.com');
    const blocked = json.result.attempts[1];
    expect(blocked).toEqual({ outcome: 'blocked', status: 0, error: 'ENDPOINT_NOT_ALLOWED' });
    expect(Object.hasOwn(blocked, 'endpoint')).toBe(false);
  });
});
