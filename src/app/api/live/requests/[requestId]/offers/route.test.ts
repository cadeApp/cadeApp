import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from './route';
import * as serverLive from '@/server/live/t204';
import { liveOffersResponseSchema } from '@/lib/live-contracts';
import { NextRequest } from 'next/server';

vi.mock('@/server/live/t204');

describe('GET /api/live/requests/[requestId]/offers', () => {
  const validUuid = '11111111-1111-1111-1111-111111111111';
  const cursor = {
    createdAt: '2026-09-26T12:00:00.000Z',
    id: '22222222-2222-2222-2222-222222222222',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 200 con payload de ofertas válido (sin cursor)', async () => {
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
      data: { data: mockOffers, nextCursor: null },
    });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ requestId: validUuid }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(liveOffersResponseSchema.safeParse(json).success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
    expect(serverLive.getRequestOffersLiveServer).toHaveBeenCalledWith(validUuid, null);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('pasa el cursor validado a getRequestOffersLiveServer si viene en query params', async () => {
    vi.mocked(serverLive.getRequestOffersLiveServer).mockResolvedValue({
      ok: true,
      data: { data: [], nextCursor: null },
    });

    const req = new NextRequest(
      `http://localhost/api/live/requests/${validUuid}/offers?cursorCreatedAt=${encodeURIComponent(
        cursor.createdAt
      )}&cursorId=${cursor.id}`
    );

    const response = await GET(req, {
      params: Promise.resolve({ requestId: validUuid }),
    });

    expect(response.status).toBe(200);
    expect(serverLive.getRequestOffersLiveServer).toHaveBeenCalledWith(validUuid, cursor);
  });

  it('retorna 400 si solo viene uno de los parámetros del cursor', async () => {
    const req = new NextRequest(
      `http://localhost/api/live/requests/${validUuid}/offers?cursorCreatedAt=${encodeURIComponent(
        cursor.createdAt
      )}`
    );

    const response = await GET(req, {
      params: Promise.resolve({ requestId: validUuid }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('INVALID_CURSOR');
    expect(serverLive.getRequestOffersLiveServer).not.toHaveBeenCalled();
  });

  it('retorna 400 si el cursor tiene valores no válidos (no UUID o no ISO)', async () => {
    const req = new NextRequest(
      `http://localhost/api/live/requests/${validUuid}/offers?cursorCreatedAt=not-a-date&cursorId=not-a-uuid`
    );

    const response = await GET(req, {
      params: Promise.resolve({ requestId: validUuid }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('INVALID_CURSOR');
    expect(serverLive.getRequestOffersLiveServer).not.toHaveBeenCalled();
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

