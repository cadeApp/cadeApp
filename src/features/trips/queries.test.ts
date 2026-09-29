import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as tripsRpc from '@/server/rpc/trips';
import * as serverSupabase from '@/server/supabase/server';
import { getTripDetails } from './queries';

vi.mock('@/server/rpc/trips', () => ({
  getTripDetailsServer: vi.fn(),
}));

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-115 / T-117 — query adapter sobre CC-008 y proyección de coordenadas post-matched', () => {
  const requestId = '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';

  const rpcTrip = {
    requestId,
    code: 'REQ-1A2B3C4D',
    status: 'matched' as const,
    merchantId: '00000000-0000-4000-8000-0000000008b1',
    merchantName: 'Kiosco Centro',
    merchantPhone: '3865222222',
    courierId: '00000000-0000-4000-8000-0000000008c1',
    courierName: 'Carlos Benítez',
    courierPhone: '3865111111',
    vehicleType: 'moto' as const,
    vehiclePlate: 'AB 123 CD',
    avatarUrl: 'https://signed.test/avatar.webp',
    amountArs: 1800,
    pickupAddress: 'San Martín 450, Aguilares',
    pickupZoneName: 'Centro',
    dropoffAddress: 'Belgrano 1220',
    dropoffZoneName: 'Barrio Sur',
    deliveryNotes: 'Frente a la plaza',
    recipientName: 'Laura Gómez',
    recipientPhone: '3865123456',
    recipientPaymentMethod: 'cash' as const,
    needsChange: true,
    cashChangeAmount: 5000,
    createdAt: '2026-09-24T10:00:00.000Z',
    matchedAt: '2026-09-24T10:05:00.000Z',
    pickedUpAt: null,
    deliveredAt: null,
  };

  const mockDbContacts = {
    pickup_lat: -27.4333,
    pickup_lng: -65.6167,
    dropoff_lat: -27.4250,
    dropoff_lng: -65.6100,
  };

  const mockDbRequest = {
    route_distance_m: 2500,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: table === 'delivery_request_contacts' ? mockDbContacts : mockDbRequest,
          error: null,
        }),
      })),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
  });

  it('delegates exactamente a getTripDetailsServer y mapea la proyección post-matched con coordenadas', async () => {
    vi.mocked(tripsRpc.getTripDetailsServer).mockResolvedValue({
      ok: true,
      data: rpcTrip,
    });

    await expect(getTripDetails(requestId)).resolves.toEqual({
      id: requestId,
      code: 'REQ-1A2B3C4D',
      status: 'matched',
      merchantId: rpcTrip.merchantId,
      merchantName: 'Kiosco Centro',
      merchantPhone: '3865222222',
      courierId: rpcTrip.courierId,
      courierName: 'Carlos Benítez',
      courierPhone: '3865111111',
      vehicleType: 'moto',
      licensePlate: 'AB 123 CD',
      avatarUrl: 'https://signed.test/avatar.webp',
      amountArs: 1800,
      pickupAddress: 'San Martín 450, Aguilares',
      pickupZoneName: 'Centro',
      pickupLat: -27.4333,
      pickupLng: -65.6167,
      dropoffAddress: 'Belgrano 1220',
      dropoffZoneName: 'Barrio Sur',
      dropoffLat: -27.4250,
      dropoffLng: -65.6100,
      routeDistanceM: 2500,
      deliveryNotes: 'Frente a la plaza',
      recipientName: 'Laura Gómez',
      recipientPhone: '3865123456',
      recipientPaymentMethod: 'cash',
      needsChange: true,
      cashChangeAmount: 5000,
      createdAt: rpcTrip.createdAt,
      matchedAt: rpcTrip.matchedAt,
      pickedUpAt: null,
      deliveredAt: null,
    });

    expect(tripsRpc.getTripDetailsServer).toHaveBeenCalledExactlyOnceWith({ requestId });
  });

  it('no hace fallback a tablas: cualquier error de autorización/estado del CC devuelve null', async () => {
    vi.mocked(tripsRpc.getTripDetailsServer).mockResolvedValue({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    await expect(getTripDetails(requestId)).resolves.toBeNull();
    expect(tripsRpc.getTripDetailsServer).toHaveBeenCalledExactlyOnceWith({ requestId });
  });

  it('propaga participantes separados y avatar firmado sin reutilizar recipientPhone', async () => {
    vi.mocked(tripsRpc.getTripDetailsServer).mockResolvedValue({
      ok: true,
      data: rpcTrip,
    });

    const trip = await getTripDetails(requestId);
    expect(trip).not.toBeNull();
    expect(trip?.courierPhone).toBe('3865111111');
    expect(trip?.merchantPhone).toBe('3865222222');
    expect(trip?.recipientPhone).toBe('3865123456');
    expect(trip?.avatarUrl).toBe('https://signed.test/avatar.webp');
  });

  it('soporta de forma resiliente la ausencia de coordenadas retornando null en esos campos', async () => {
    vi.mocked(tripsRpc.getTripDetailsServer).mockResolvedValue({
      ok: true,
      data: rpcTrip,
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const trip = await getTripDetails(requestId);
    expect(trip).not.toBeNull();
    expect(trip?.pickupLat).toBeNull();
    expect(trip?.pickupLng).toBeNull();
    expect(trip?.dropoffLat).toBeNull();
    expect(trip?.dropoffLng).toBeNull();
    expect(trip?.routeDistanceM).toBeNull();
  });
});
