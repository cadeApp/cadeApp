import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from './route';
import * as serverLive from '@/server/live/t204';
import { liveOffersResponseSchema } from '@/lib/live-contracts';
import { type NextRequest } from 'next/server';

vi.mock('@/server/live/t204');

describe('GET /api/live/requests/[requestId]/offers', () => {
  const validUuid = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 200 con payload de ofertas válido', async () => {
    const mockOffers = [
      {
        id: '22222222-2222-2222-2222-222222222222',
        courierId: '33333333-3333-3333-3333-333333333333',
        courierName: 'Juan Repartidor',
        vehicleType: 'motorcycle',
        amountArs: 2000,
        etaMinutes: 15,
        message: 'Listo',
        licenseStatus: 'verified' as const,
        insuranceStatus: 'none' as const,
        docLevel: 1 as const,
        createdAt: '2026-09-26T12:00:00Z',
        status: 'pending' as const,
      },
    ];

    vi.mocked(serverLive.getRequestOffersLiveServer).mockResolvedValue({
      ok: true,
      data: mockOffers,
    });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ requestId: validUuid }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(liveOffersResponseSchema.safeParse(json).success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('retorna 404 si la solicitud no existe o es de otro usuario', async () => {
    vi.mocked(serverLive.getRequestOffersLiveServer).mockResolvedValue({
      ok: false,
      error: 'NOT_FOUND',
      status: 404,
    });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ requestId: validUuid }),
    });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('NOT_FOUND');
  });
});
