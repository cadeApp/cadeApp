import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from './route';
import * as serverLive from '@/server/live/t204';
import { liveFeedResponseSchema } from '@/lib/live-contracts';

vi.mock('@/server/live/t204');

describe('GET /api/live/available-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 200 con payload válido cuando la consulta de servidor es exitosa', async () => {
    const mockData = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Aguilares',
        approxDistanceKm: '1,5',
        packageType: 'small' as const,
        recipientPaymentMethod: 'cash' as const,
        needsChange: false,
        cashChangeAmount: null,
        notes: null,
        publishedAt: '2026-09-26T12:00:00Z',
        expiresAt: null,
        hasMyOffer: true,
        myOfferAmountArs: 1500,
      },
    ];

    vi.mocked(serverLive.getAvailableRequestsLiveServer).mockResolvedValue({
      ok: true,
      data: mockData,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(liveFeedResponseSchema.safeParse(json).success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('retorna status no-2xx y objeto de error cuando el servidor falla', async () => {
    vi.mocked(serverLive.getAvailableRequestsLiveServer).mockResolvedValue({
      ok: false,
      error: 'UNAUTHENTICATED',
      status: 401,
    });

    const response = await GET();
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.error).toBe('UNAUTHENTICATED');
  });
});
