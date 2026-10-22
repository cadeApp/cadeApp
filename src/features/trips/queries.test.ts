import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as tripsRpc from '@/server/rpc/trips';
import * as serverSupabase from '@/server/supabase/server';
import {
  getTripDetails,
  getActiveTripsForCourier,
  loadCancellationHistoryForRequestDetail,
} from './queries';

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
    dropsCount: 1,
    drops: [
      {
        id: '2a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        position: 1,
        dropoffZoneName: 'Barrio Sur',
        dropoffAddress: 'Belgrano 1220',
        recipientName: 'Laura Gómez',
        recipientPhone: '3865123456',
        deliveryNotes: 'Frente a la plaza',
        cashChangeAmount: 5000,
        packageType: 'chico' as const,
        recipientPaymentMethod: 'cash' as const,
        needsChange: true,
        approxDistanceM: 2500,
        status: 'pending' as const,
        deliveredAt: null,
        failedReason: null,
        dropoffLat: -27.4250,
        dropoffLng: -65.6100,
      },
    ],
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
      totalAmountArs: 1800,
      collectibleAmountArs: 0,
      allDropsFailed: false,
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
      dropsCount: 1,
      drops: rpcTrip.drops,
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

describe('T-360 — getActiveTripsForCourier', () => {
  const courierId = '00000000-0000-4000-8000-0000000008c1';
  let mockAuthGetUser: ReturnType<typeof vi.fn>;
  let mockRequestsSelect: ReturnType<typeof vi.fn>;
  let mockRequestsIn: ReturnType<typeof vi.fn>;
  let mockOffersSelect: ReturnType<typeof vi.fn>;
  let mockOffersIn: ReturnType<typeof vi.fn>;
  let mockOffersEqCourier: ReturnType<typeof vi.fn>;
  let mockOffersEqStatus: ReturnType<typeof vi.fn>;
  let mockDropsSelect: ReturnType<typeof vi.fn>;
  let mockDropsIn: ReturnType<typeof vi.fn>;
  let mockDropsEqPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: courierId } },
      error: null,
    });

    mockRequestsIn = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    mockRequestsSelect = vi.fn().mockReturnValue({
      in: mockRequestsIn,
    });

    mockOffersEqStatus = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    mockOffersEqCourier = vi.fn().mockReturnValue({
      eq: mockOffersEqStatus,
    });
    mockOffersIn = vi.fn().mockReturnValue({
      eq: mockOffersEqCourier,
    });
    mockOffersSelect = vi.fn().mockReturnValue({
      in: mockOffersIn,
    });

    mockDropsEqPosition = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    mockDropsIn = vi.fn().mockReturnValue({
      eq: mockDropsEqPosition,
    });
    mockDropsSelect = vi.fn().mockReturnValue({
      in: mockDropsIn,
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: mockAuthGetUser,
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'delivery_requests') {
          return { select: mockRequestsSelect };
        }
        if (table === 'offers') {
          return { select: mockOffersSelect };
        }
        if (table === 'delivery_request_drops') {
          return { select: mockDropsSelect };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
  });

  it('devuelve 0 viajes cuando no hay solicitudes activas', async () => {
    mockRequestsIn.mockResolvedValue({ data: [], error: null });

    const result = await getActiveTripsForCourier();

    expect(result).toEqual({ courierId, trips: [] });
    expect(mockRequestsIn).toHaveBeenCalledWith('status', ['matched', 'in_transit']);
    expect(mockOffersSelect).not.toHaveBeenCalled();
  });

  it('devuelve 1 viaje cuando coinciden bidireccionalmente la solicitud y la oferta', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-1',
          status: 'matched',
          accepted_offer_id: 'off-1',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [
        {
          id: 'off-1',
          request_id: 'req-1',
          amount_ars: 2000,
        },
      ],
      error: null,
    });

    const result = await getActiveTripsForCourier();

    expect(result.courierId).toBe(courierId);
    expect(result.trips).toEqual([
      {
        id: 'req-1',
        status: 'matched',
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Barrio Sur',
        dropsCount: 1,
        amountArs: 2000,
        matchedAt: '2026-10-15T00:00:00.000Z',
      },
    ]);

    expect(mockOffersIn).toHaveBeenCalledWith('id', ['off-1']);
    expect(mockOffersEqCourier).toHaveBeenCalledWith('courier_id', courierId);
    expect(mockOffersEqStatus).toHaveBeenCalledWith('status', 'accepted');
  });

  it('devuelve N viajes manteniendo correspondencia de ofertas y orden', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-1',
          status: 'matched',
          accepted_offer_id: 'off-1',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
        {
          id: 'req-2',
          status: 'in_transit',
          accepted_offer_id: 'off-2',
          drops_count: 1,
          matched_at: '2026-10-15T00:10:00.000Z',
          pickup_zone: { name: 'Barrio Norte' },
          dropoff_zone: { name: 'Centro' },
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [
        { id: 'off-1', request_id: 'req-1', amount_ars: 1500 },
        { id: 'off-2', request_id: 'req-2', amount_ars: 2500 },
      ],
      error: null,
    });

    const result = await getActiveTripsForCourier();

    expect(result.trips).toHaveLength(2);
    const [firstTrip, secondTrip] = result.trips;
    expect(firstTrip).toBeDefined();
    expect(secondTrip).toBeDefined();
    if (!firstTrip || !secondTrip) throw new Error('Expected two trips');
    expect(firstTrip.id).toBe('req-2');
    expect(firstTrip.status).toBe('in_transit');
    expect(firstTrip.amountArs).toBe(2500);
    expect(secondTrip.id).toBe('req-1');
    expect(secondTrip.status).toBe('matched');
    expect(secondTrip.amountArs).toBe(1500);
  });

  it('excluye solicitudes con estados no activos (delivered, cancelled, published)', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-delivered',
          status: 'delivered',
          accepted_offer_id: 'off-1',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [{ id: 'off-1', request_id: 'req-delivered', amount_ars: 2000 }],
      error: null,
    });

    const result = await getActiveTripsForCourier();

    expect(result.trips).toEqual([]);
    expect(mockRequestsIn).toHaveBeenCalledWith('status', ['matched', 'in_transit']);
  });

  it('excluye solicitud si accepted_offer_id no coincide con la oferta retornada', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-1',
          status: 'matched',
          accepted_offer_id: 'off-different',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [{ id: 'off-1', request_id: 'req-1', amount_ars: 2000 }],
      error: null,
    });

    const result = await getActiveTripsForCourier();
    expect(result.trips).toEqual([]);
  });

  it('excluye solicitud si la oferta pertenece a otro request_id', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-1',
          status: 'matched',
          accepted_offer_id: 'off-1',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [{ id: 'off-1', request_id: 'req-another', amount_ars: 2000 }],
      error: null,
    });

    const result = await getActiveTripsForCourier();
    expect(result.trips).toEqual([]);
  });

  it('excluye ofertas si pertenecen a otro courier (accepted ajeno)', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-1',
          status: 'matched',
          accepted_offer_id: 'off-1',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await getActiveTripsForCourier();
    expect(result.trips).toEqual([]);
    expect(mockOffersEqCourier).toHaveBeenCalledWith('courier_id', courierId);
  });

  it('formatea multi-drop con drops_count=3 con dropoffZoneName en null', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-multidrop',
          status: 'matched',
          accepted_offer_id: 'off-m',
          drops_count: 3,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: null,
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [{ id: 'off-m', request_id: 'req-multidrop', amount_ars: 4500 }],
      error: null,
    });

    const result = await getActiveTripsForCourier();

    expect(result.trips).toHaveLength(1);
    const [firstTrip] = result.trips;
    expect(firstTrip).toBeDefined();
    if (!firstTrip) throw new Error('Expected one trip');
    expect(firstTrip.dropsCount).toBe(3);
    expect(firstTrip.dropoffZoneName).toBeNull();
    expect(mockDropsSelect).not.toHaveBeenCalled();
  });

  it('busca dropoffZoneName en delivery_request_drops para single-drop cuando dropoff_zone es null', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-single',
          status: 'matched',
          accepted_offer_id: 'off-s',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: null,
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [{ id: 'off-s', request_id: 'req-single', amount_ars: 2000 }],
      error: null,
    });

    mockDropsEqPosition.mockResolvedValue({
      data: [
        {
          request_id: 'req-single',
          position: 1,
          dropoff_zone: { name: 'Barrio Oeste' },
        },
      ],
      error: null,
    });

    const result = await getActiveTripsForCourier();

    expect(result.trips).toHaveLength(1);
    const [singleTrip] = result.trips;
    expect(singleTrip).toBeDefined();
    if (!singleTrip) throw new Error('Expected one trip');
    expect(singleTrip.dropoffZoneName).toBe('Barrio Oeste');
    expect(mockDropsIn).toHaveBeenCalledWith('request_id', ['req-single']);
    expect(mockDropsEqPosition).toHaveBeenCalledWith('position', 1);
  });

  it('lanza error sanitizado si la consulta de delivery_request_drops falla', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-single',
          status: 'matched',
          accepted_offer_id: 'off-s',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: null,
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [{ id: 'off-s', request_id: 'req-single', amount_ars: 2000 }],
      error: null,
    });

    mockDropsEqPosition.mockResolvedValue({
      data: null,
      error: new Error('permission denied on delivery_request_drops'),
    });

    await expect(getActiveTripsForCourier()).rejects.toThrow(
      'Error al consultar zonas de entregas activas'
    );
  });

  it('conserva dropoffZoneName en null si delivery_request_drops devuelve array vacío sin error', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-single',
          status: 'matched',
          accepted_offer_id: 'off-s',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: null,
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [{ id: 'off-s', request_id: 'req-single', amount_ars: 2000 }],
      error: null,
    });

    mockDropsEqPosition.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await getActiveTripsForCourier();

    expect(result.trips).toHaveLength(1);
    const [singleTrip] = result.trips;
    expect(singleTrip).toBeDefined();
    if (!singleTrip) throw new Error('Expected one trip');
    expect(singleTrip.dropoffZoneName).toBeNull();
  });

  it('lanza error si la sesión está ausente o auth.getUser falla', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Token expirado'),
    });

    await expect(getActiveTripsForCourier()).rejects.toThrow(
      'No autenticado al consultar viajes activos'
    );
  });

  it('lanza error sanitizado si falla la consulta de delivery_requests o de offers', async () => {
    mockRequestsIn.mockResolvedValue({
      data: null,
      error: new Error('PG connection lost'),
    });

    await expect(getActiveTripsForCourier()).rejects.toThrow(
      'Error al consultar solicitudes activas'
    );

    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-1',
          status: 'matched',
          accepted_offer_id: 'off-1',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: null,
      error: new Error('PG connection lost'),
    });

    await expect(getActiveTripsForCourier()).rejects.toThrow(
      'Error al consultar ofertas activas'
    );
  });

  it('no expone datos sensibles ni PII (contacto, teléfono, dirección exacta, notas)', async () => {
    mockRequestsIn.mockResolvedValue({
      data: [
        {
          id: 'req-1',
          status: 'matched',
          accepted_offer_id: 'off-1',
          drops_count: 1,
          matched_at: '2026-10-15T00:00:00.000Z',
          pickup_zone: { name: 'Centro' },
          dropoff_zone: { name: 'Barrio Sur' },
        },
      ],
      error: null,
    });

    mockOffersEqStatus.mockResolvedValue({
      data: [{ id: 'off-1', request_id: 'req-1', amount_ars: 2000 }],
      error: null,
    });

    const result = await getActiveTripsForCourier();
    const [firstTrip] = result.trips;
    expect(firstTrip).toBeDefined();
    if (!firstTrip) throw new Error('Expected one trip');
    const trip = firstTrip as unknown as Record<string, unknown>;
    const forbiddenKeys = [
      'phone',
      'recipientPhone',
      'merchantPhone',
      'recipientName',
      'merchantName',
      'address',
      'pickupAddress',
      'dropoffAddress',
      'deliveryNotes',
      'pin',
      'pickupLat',
      'pickupLng',
      'dropoffLat',
      'dropoffLng',
    ];

    for (const key of forbiddenKeys) {
      expect(trip[key]).toBeUndefined();
    }

    expect(Object.keys(trip).sort()).toEqual(
      ['amountArs', 'dropoffZoneName', 'dropsCount', 'id', 'matchedAt', 'pickupZoneName', 'status'].sort()
    );
  });
});

describe('T-373 / PR425-H02 — getTripDetails distingue ausencia esperada de falla', () => {
  const requestId = '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
  // Lo que /trips/[id] lee en paralelo: el repartidor tiene una cancelación propia previa en este pedido.
  const ownHistory = Promise.resolve({
    ok: true as const,
    data: {
      version: '1.0' as const,
      requestId,
      events: [{ id: '3a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d' }],
      pagination: { limit: 50, hasMore: false, nextCursor: null },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['NOT_FOUND', 'UNAUTHORIZED_ACTOR', 'VALIDATION_ERROR', 'INVALID_STATE_TRANSITION', 'UNAUTHENTICATED'] as const)(
    '%s es ausencia esperada: devuelve null (habilita el 404 o la vista de cancelación)',
    async (code) => {
      vi.mocked(tripsRpc.getTripDetailsServer).mockResolvedValue({ ok: false, code });
      await expect(getTripDetails(requestId)).resolves.toBeNull();
    }
  );

  it('INTERNAL_ERROR no es ausencia: lanza y no consulta coordenadas', async () => {
    vi.mocked(tripsRpc.getTripDetailsServer).mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    await expect(getTripDetails(requestId)).rejects.toThrow('TRIP_DETAILS_UNAVAILABLE');
    expect(serverSupabase.createClient).not.toHaveBeenCalled();
  });

  it('con historial propio en paralelo (como /trips/[id]), una falla del detalle rechaza en vez de dar un null que mostraría «Cancelaste esta asignación»', async () => {
    vi.mocked(tripsRpc.getTripDetailsServer).mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    await expect(Promise.all([getTripDetails(requestId), ownHistory])).rejects.toThrow('TRIP_DETAILS_UNAVAILABLE');
  });

  it('rematch: si existe el viaje actual se devuelve el detalle aunque haya historial previo', async () => {
    const current = {
      requestId,
      code: 'REQ-1A2B3C4D',
      status: 'matched' as const,
      merchantId: '00000000-0000-4000-8000-0000000008b1',
      merchantName: 'Kiosco Centro',
      merchantPhone: null,
      courierId: '00000000-0000-4000-8000-0000000008c1',
      courierName: 'Carlos Benítez',
      courierPhone: null,
      vehicleType: 'moto' as const,
      vehiclePlate: null,
      avatarUrl: null,
      amountArs: 1800,
      pickupAddress: 'San Martín 450',
      pickupZoneName: 'Centro',
      dropoffAddress: 'Belgrano 1220',
      dropoffZoneName: 'Barrio Sur',
      deliveryNotes: null,
      recipientName: 'Laura Gómez',
      recipientPhone: '3865123456',
      recipientPaymentMethod: 'cash' as const,
      needsChange: false,
      cashChangeAmount: null,
      createdAt: '2026-09-24T10:00:00.000Z',
      matchedAt: '2026-09-24T10:05:00.000Z',
      pickedUpAt: null,
      deliveredAt: null,
      dropsCount: 1,
      drops: [],
    };
    vi.mocked(tripsRpc.getTripDetailsServer).mockResolvedValue({ ok: true, data: current } as never);
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const [trip] = await Promise.all([getTripDetails(requestId), ownHistory]);
    expect(trip?.id).toBe(requestId);
    expect(trip?.courierId).toBe('00000000-0000-4000-8000-0000000008c1');
  });
});

describe('T-373 / PR425-H03 — loadCancellationHistoryForRequestDetail', () => {
  const requestId = '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
  const page = {
    ok: true as const,
    data: {
      version: '1.0' as const,
      requestId,
      events: [],
      pagination: { limit: 50, hasMore: false, nextCursor: null },
    },
  };

  it.each(['published', 'cancelled', 'expired'] as const)('%s muestra el historial: llama a la RPC una vez', async (status) => {
    const load = vi.fn().mockResolvedValue(page);
    await expect(loadCancellationHistoryForRequestDetail(requestId, status, load)).resolves.toEqual(page);
    expect(load).toHaveBeenCalledExactlyOnceWith({ requestId });
  });

  it.each(['draft', 'matched', 'in_transit', 'delivered'] as const)(
    '%s no muestra el historial (o redirige a /trips): no llama a la RPC',
    async (status) => {
      const load = vi.fn().mockResolvedValue(page);
      await expect(loadCancellationHistoryForRequestDetail(requestId, status, load)).resolves.toBeNull();
      expect(load).not.toHaveBeenCalled();
    }
  );
});
