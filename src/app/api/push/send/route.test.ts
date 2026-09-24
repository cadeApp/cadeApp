// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { sendPushNotification } from '@/server/push/sender';

vi.mock('@/server/env', () => ({
  serverEnv: {
    CRON_SECRET: 'test-cron-secret-12345',
  },
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
  });

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
        authorization: 'Bearer test-cron-secret-12345',
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
      attempts: [{ endpoint: 'https://push.example.com/sub/1', status: 201 }],
      errors: [],
    });

    const req = new NextRequest('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-cron-secret-12345',
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
});
