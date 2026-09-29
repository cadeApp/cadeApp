// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { checkUptimeHealth } from '@/server/observability';

vi.mock('@/server/env', () => ({
  serverEnv: {
    CRON_SECRET: 'test-cron-secret-12345',
  },
}));

vi.mock('@/server/observability', () => ({
  checkUptimeHealth: vi.fn(),
}));

describe('GET & POST /api/cron/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responde 401 si no se envía la cabecera Authorization', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/health');
    const resGet = await GET(req);
    expect(resGet.status).toBe(401);
    const jsonGet = await resGet.json();
    expect(jsonGet).toEqual({ error: 'Unauthorized' });

    const resPost = await POST(req);
    expect(resPost.status).toBe(401);
  });

  it('responde 401 si la cabecera Authorization contiene un token incorrecto', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/health', {
      headers: {
        authorization: 'Bearer token-invalido',
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('ejecuta checkUptimeHealth y responde 200 cuando el endpoint es saludable', async () => {
    vi.mocked(checkUptimeHealth).mockResolvedValue({
      healthy: true,
      status: 200,
      latencyMs: 15,
    });

    const req = new NextRequest('http://localhost:3000/api/cron/health', {
      headers: {
        authorization: 'Bearer test-cron-secret-12345',
      },
    });

    const resGet = await GET(req);
    expect(resGet.status).toBe(200);
    const json = await resGet.json();
    expect(json.ok).toBe(true);
    expect(json.result.healthy).toBe(true);

    const resPost = await POST(req);
    expect(resPost.status).toBe(200);
  });

  it('ejecuta checkUptimeHealth y responde 503 cuando el endpoint no es saludable', async () => {
    vi.mocked(checkUptimeHealth).mockResolvedValue({
      healthy: false,
      status: 500,
      latencyMs: 45,
      error: 'HTTP 500',
    });

    const req = new NextRequest('http://localhost:3000/api/cron/health', {
      headers: {
        authorization: 'Bearer test-cron-secret-12345',
      },
    });

    const resGet = await GET(req);
    expect(resGet.status).toBe(503);
    const json = await resGet.json();
    expect(json.ok).toBe(false);
    expect(json.result.healthy).toBe(false);
    expect(json.result.error).toBe('HTTP 500');
  });
});
