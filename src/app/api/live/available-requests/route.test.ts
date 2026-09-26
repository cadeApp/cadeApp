import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from './route';
import * as serverLive from '@/server/live/t204';
import { liveFeedResponseSchema } from '@/lib/live-contracts';
import { NextRequest } from 'next/server';

vi.mock('@/server/live/t204');

describe('GET /api/live/available-requests', () => {
  const cursor = {
    createdAt: '2026-09-26T12:00:00.000Z',
    id: '11111111-1111-1111-1111-111111111111',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 200 con payload válido cuando la consulta de servidor es exitosa (sin cursor)', async () => {
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
      data: { data: mockData, nextCursor: null },
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(liveFeedResponseSchema.safeParse(json).success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
    expect(serverLive.getAvailableRequestsLiveServer).toHaveBeenCalledWith(null);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('pasa el cursor validado a getAvailableRequestsLiveServer si viene en query params', async () => {
    vi.mocked(serverLive.getAvailableRequestsLiveServer).mockResolvedValue({
      ok: true,
      data: { data: [], nextCursor: null },
    });

    const req = new NextRequest(
      `http://localhost/api/live/available-requests?cursorCreatedAt=${encodeURIComponent(
        cursor.createdAt
      )}&cursorId=${cursor.id}`
    );

    const response = await GET(req);
    expect(response.status).toBe(200);
    expect(serverLive.getAvailableRequestsLiveServer).toHaveBeenCalledWith(cursor);
  });

  it('retorna 400 si solo viene uno de los parámetros del cursor', async () => {
    const req = new NextRequest(
      `http://localhost/api/live/available-requests?cursorCreatedAt=${encodeURIComponent(
        cursor.createdAt
      )}`
    );

    const response = await GET(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('INVALID_CURSOR');
    expect(serverLive.getAvailableRequestsLiveServer).not.toHaveBeenCalled();
  });

  it('retorna 400 si el cursor tiene valores no válidos (no UUID o no ISO)', async () => {
    const req = new NextRequest(
      `http://localhost/api/live/available-requests?cursorCreatedAt=not-a-date&cursorId=not-a-uuid`
    );

    const response = await GET(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('INVALID_CURSOR');
    expect(serverLive.getAvailableRequestsLiveServer).not.toHaveBeenCalled();
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

