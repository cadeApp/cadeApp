// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { createAdminClient } from '@/server/supabase/admin';

vi.mock('@/server/env', () => ({
  serverEnv: {
    CRON_SECRET: 'test-cron-secret-12345',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  },
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('GET & POST /api/cron/sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responde 401 si no se envía la cabecera Authorization', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/sweep');
    const resGet = await GET(req);
    expect(resGet.status).toBe(401);
    const jsonGet = await resGet.json();
    expect(jsonGet).toEqual({ error: 'Unauthorized' });

    const resPost = await POST(req);
    expect(resPost.status).toBe(401);
  });

  it('responde 401 si la cabecera Authorization contiene un token incorrecto', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/sweep', {
      headers: {
        authorization: 'Bearer token-invalido',
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('ejecuta el barrido y responde 200 cuando el CRON_SECRET es válido', async () => {
    const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'courier_documents') {
        return {
          select: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'doc-1',
                    courier_id: 'courier-1',
                    storage_path: 'courier-1/dni_front.jpg',
                    purge_after: '2026-09-01T00:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'delivery_requests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [{ id: 'req-1', merchant_id: 'merchant-1' }],
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'offers') {
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }

      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'merchant-2', paid_until: '2026-08-01' }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { key: 'subscription_grace_days', value: '0' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'audit_log') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      return {};
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          remove: mockStorageRemove,
        }),
      },
    } as unknown as ReturnType<typeof createAdminClient>);

    const req = new NextRequest('http://localhost:3000/api/cron/sweep', {
      headers: {
        authorization: 'Bearer test-cron-secret-12345',
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.swept).toBeDefined();
    expect(json.swept.purgedDocsCount).toBe(1);
    expect(json.swept.expiredRequestsCount).toBe(1);
  });
});
