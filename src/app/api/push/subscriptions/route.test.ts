// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, DELETE } from './route';
import { createClient } from '@/server/supabase/server';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Route Handlers /api/push/subscriptions (POST y DELETE)', () => {
  const USER_ID = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/push/subscriptions', () => {
    it('responde 401 si no hay usuario autenticado', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') }),
        },
      } as any);

      const req = new NextRequest('http://localhost:3000/api/push/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://push.example.com/sub/1',
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: 'Unauthorized' });
    });

    it('responde 400 si el payload es inválido', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
        },
      } as any);

      const req = new NextRequest('http://localhost:3000/api/push/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'not-a-valid-url',
          p256dh: '',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid payload');
    });

    it('responde 200 y registra la suscripción con el usuario autenticado', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          upsert: mockUpsert,
        }),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/push/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://push.example.com/sub/1',
          p256dh: 'valid-p256dh',
          auth: 'valid-auth',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          endpoint: 'https://push.example.com/sub/1',
          p256dh: 'valid-p256dh',
          auth: 'valid-auth',
        }),
        { onConflict: 'endpoint' }
      );
    });

    it('responde 500 ante error en la base de datos', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ error: new Error('DB connection lost') }),
        }),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/push/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://push.example.com/sub/1',
          p256dh: 'valid-p256dh',
          auth: 'valid-auth',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: 'Database error' });
    });
  });

  describe('DELETE /api/push/subscriptions', () => {
    it('responde 401 si no hay usuario autenticado', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') }),
        },
      } as any);

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
      } as any);

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
      } as any);

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
