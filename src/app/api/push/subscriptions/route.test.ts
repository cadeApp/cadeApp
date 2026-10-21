// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, DELETE } from './route';
import { createClient } from '@/server/supabase/server';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

type SessionClient = Awaited<ReturnType<typeof createClient>>;

describe('Route Handlers /api/push/subscriptions (POST y DELETE)', () => {
  const USER_ID = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/push/subscriptions', () => {
    const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/t383-endpoint-abc';
    const P256DH = 'BKeyP256dh_valid-base64url';
    const AUTH = 'AuthKey_valid-1';
    const SUBSCRIPTION_ID = '00000000-0000-4000-8000-0000000383a1';
    // Cuenta dueña anterior del endpoint: nunca puede aparecer en la respuesta.
    const PREVIOUS_OWNER_ID = '00000000-0000-4000-8000-0000000383b2';

    const consoleSpies: Array<ReturnType<typeof vi.spyOn>> = [];

    beforeEach(() => {
      consoleSpies.length = 0;
      for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
        consoleSpies.push(vi.spyOn(console, method).mockImplementation(() => undefined));
      }
    });

    afterEach(() => {
      for (const spy of consoleSpies) spy.mockRestore();
    });

    function expectNothingLogged() {
      for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
    }

    function sessionClient(rpcResponse?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    }) {
      const rpc = vi.fn().mockResolvedValue(rpcResponse ?? { data: null, error: null });
      const from = vi.fn();
      const getUser = vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: { getUser },
        rpc,
        from,
      } as unknown as SessionClient);
      return { rpc, from, getUser };
    }

    function postRequest(body: unknown) {
      return new NextRequest('http://localhost:3000/api/push/subscriptions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    const VALID_BODY = { endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH, platform: 'web' };

    it('responde 401 si no hay usuario autenticado', async () => {
      const rpc = vi.fn();
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') }),
        },
        rpc,
      } as unknown as SessionClient);

      const res = await POST(postRequest(VALID_BODY));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
      expect(rpc).not.toHaveBeenCalled();
    });

    it('responde 400 si el payload es inválido y no llama la RPC', async () => {
      const { rpc } = sessionClient();

      const res = await POST(postRequest({ endpoint: 'not-a-valid-url', p256dh: '' }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid payload');
      expect(rpc).not.toHaveBeenCalled();
    });

    it('alta nueva: llama register_push_subscription con el cliente de sesión, sin upsert directo, y responde 200', async () => {
      const { rpc, from } = sessionClient({
        data: { subscriptionId: SUBSCRIPTION_ID, created: true, reassigned: false },
        error: null,
      });

      const res = await POST(postRequest(VALID_BODY));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('register_push_subscription', {
        p_payload: { endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH, platform: 'web' },
      });
      expect(from).not.toHaveBeenCalled();
      expectNothingLogged();
    });

    it('sin platform manda platform null a la RPC', async () => {
      const { rpc } = sessionClient({
        data: { subscriptionId: SUBSCRIPTION_ID, created: true, reassigned: false },
        error: null,
      });

      const res = await POST(postRequest({ endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH }));
      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('register_push_subscription', {
        p_payload: { endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH, platform: null },
      });
    });

    it('reintento de la misma cuenta: la RPC actualiza la fila y la ruta responde 200', async () => {
      const { rpc, from } = sessionClient({
        data: { subscriptionId: SUBSCRIPTION_ID, created: false, reassigned: false },
        error: null,
      });

      const first = await POST(postRequest(VALID_BODY));
      const second = await POST(postRequest(VALID_BODY));
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await second.json()).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(from).not.toHaveBeenCalled();
    });

    it('reasignación desde otra cuenta: responde 200 sin exponer la cuenta anterior', async () => {
      const { rpc, from } = sessionClient({
        data: { subscriptionId: SUBSCRIPTION_ID, created: false, reassigned: true },
        error: null,
      });

      const res = await POST(postRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ ok: true });
      expect(text).not.toContain(PREVIOUS_OWNER_ID);
      expect(text).not.toContain(USER_ID);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
      expectNothingLogged();
    });

    it('una salida de la RPC que trae datos de más (p. ej. el dueño anterior) se rechaza con 500', async () => {
      sessionClient({
        data: {
          subscriptionId: SUBSCRIPTION_ID,
          created: false,
          reassigned: true,
          previousUserId: PREVIOUS_OWNER_ID,
        },
        error: null,
      });

      const res = await POST(postRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).not.toContain(PREVIOUS_OWNER_ID);
    });

    it.each([
      ['UNAUTHENTICATED', 'P0001', 401, { error: 'Unauthorized' }],
      ['VALIDATION_ERROR', 'P0001', 400, { error: 'Invalid payload' }],
      ['UNAUTHORIZED_ACTOR', 'P0001', 403, { error: 'Forbidden' }],
      ['INTERNAL_ERROR', 'P0001', 500, { error: 'Internal Error' }],
      ['permission denied for function register_push_subscription', '42501', 403, { error: 'Forbidden' }],
      ['duplicate key value violates unique constraint', '23505', 500, { error: 'Internal Error' }],
    ] as const)(
      'error %s (%s) de la RPC → %i, sin loguear el endpoint ni las claves',
      async (message, code, status, body) => {
        sessionClient({ data: null, error: { message, code } });

        const res = await POST(postRequest(VALID_BODY));
        expect(res.status).toBe(status);
        const text = await res.text();
        expect(JSON.parse(text)).toEqual(body);
        expect(text).not.toContain(ENDPOINT);
        expect(text).not.toContain(P256DH);
        expect(text).not.toContain(AUTH);
        expectNothingLogged();
      }
    );

    it('platform distinta de web la rechaza el contrato de la RPC → 400 sin llamar la base', async () => {
      const { rpc } = sessionClient();

      const res = await POST(postRequest({ ...VALID_BODY, platform: 'android' }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid payload' });
      expect(rpc).not.toHaveBeenCalled();
    });

    it('si la llamada a la RPC lanza, responde 500 sin loguear nada', async () => {
      const rpc = vi.fn().mockRejectedValue(new Error(`socket closed for ${ENDPOINT}`));
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
        },
        rpc,
      } as unknown as SessionClient);

      const res = await POST(postRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: 'Internal Error' });
      expect(text).not.toContain(ENDPOINT);
      expectNothingLogged();
    });
  });

  describe('DELETE /api/push/subscriptions', () => {
    it('responde 401 si no hay usuario autenticado', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') }),
        },
      } as unknown as SessionClient);

      const req = new NextRequest('http://localhost:3000/api/push/subscriptions', {
        method: 'DELETE',
        body: JSON.stringify({
          endpoint: 'https://push.example.com/sub/1',
        }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: 'Unauthorized' });
    });

    it('responde 400 si el endpoint a eliminar no es una URL válida', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
        },
      } as unknown as SessionClient);

      const req = new NextRequest('http://localhost:3000/api/push/subscriptions', {
        method: 'DELETE',
        body: JSON.stringify({
          endpoint: 'invalid-url',
        }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid payload');
    });

    it('responde 200 y elimina la suscripción perteneciente al usuario', async () => {
      const mockEqUserId = vi.fn().mockResolvedValue({ error: null });
      const mockEqEndpoint = vi.fn().mockReturnValue({ eq: mockEqUserId });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEqEndpoint });

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          delete: mockDelete,
        }),
      } as unknown as SessionClient);

      const req = new NextRequest('http://localhost:3000/api/push/subscriptions', {
        method: 'DELETE',
        body: JSON.stringify({
          endpoint: 'https://push.example.com/sub/1',
        }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true });

      expect(mockEqEndpoint).toHaveBeenCalledWith('endpoint', 'https://push.example.com/sub/1');
      expect(mockEqUserId).toHaveBeenCalledWith('user_id', USER_ID);
    });
  });
});
