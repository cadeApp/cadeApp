import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import * as live from '@/server/live/online-couriers';
import { liveOnlineCouriersResponseSchema } from '@/lib/live-contracts';

vi.mock('@/server/live/online-couriers');

describe('T-415: GET /api/live/online-couriers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 con el conteo validado y sin caché', async () => {
    vi.mocked(live.getOnlineCouriersLiveServer).mockResolvedValue({ ok: true, data: { count: 2, windowMinutes: 10 } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    const body: unknown = await response.json();
    expect(liveOnlineCouriersResponseSchema.parse(body)).toEqual({ count: 2, windowMinutes: 10 });
  });

  it('propaga el estado del error sin exponer detalles', async () => {
    vi.mocked(live.getOnlineCouriersLiveServer).mockResolvedValue({ ok: false, error: 'UNAUTHORIZED_ACTOR', status: 403 });
    const response = await GET();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'UNAUTHORIZED_ACTOR' });
  });
});
