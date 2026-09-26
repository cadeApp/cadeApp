import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from './route';
import * as serverLive from '@/server/live/t204';
import { liveTripResponseSchema } from '@/lib/live-contracts';
import { type NextRequest } from 'next/server';

vi.mock('@/server/live/t204');

describe('GET /api/live/trips/[tripId]', () => {
  const validUuid = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 200 con payload de viaje activo', async () => {
    vi.mocked(serverLive.getTripLiveStateServer).mockResolvedValue({
      ok: true,
      data: {
        id: validUuid,
        status: 'in_transit',
      },
    });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ tripId: validUuid }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(liveTripResponseSchema.safeParse(json).success).toBe(true);
    expect(json.data?.status).toBe('in_transit');
  });

  it('retorna 200 con data: null cuando el viaje no existe (NOT_FOUND)', async () => {
    vi.mocked(serverLive.getTripLiveStateServer).mockResolvedValue({
      ok: true,
      data: null,
    });

    const response = await GET({} as NextRequest, {
      params: { tripId: validUuid },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toBeNull();
  });

  it('retorna 403 si el actor no tiene autorización', async () => {
    vi.mocked(serverLive.getTripLiveStateServer).mockResolvedValue({
      ok: false,
      error: 'UNAUTHORIZED_ACTOR',
      status: 403,
    });

    const response = await GET({} as NextRequest, {
      params: { tripId: validUuid },
    });

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe('UNAUTHORIZED_ACTOR');
  });
});
