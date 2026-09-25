import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getTripDetails } from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-115 DoD: queries de viaje (revelación progresiva, identidad y cobro en mano) (H09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const merchantUserId = 'merchant-uuid-1111';
  const courierUserId = 'courier-uuid-2222';
  const otherUserId = 'other-uuid-3333';
  const requestId = 'req-uuid-1234';
  const acceptedOfferId = 'offer-uuid-accepted-999';
  const otherOfferId = 'offer-uuid-other-888';

  const mockDbTripRow = {
    id: requestId,
    code: 'REQ-5544',
    merchant_id: merchantUserId,
    status: 'matched' as const,
    pickup_address: 'San Martín 450, Aguilares',
    pickup_zone_id: 'zone-1',
    dropoff_zone_id: 'zone-2',
    pickup_zone: { name: 'Centro' },
    dropoff_zone: { name: 'Barrio San Martín' },
    package_type: 'chico',
    recipient_payment_method: 'cash',
    needs_change: true,
    cash_change_amount: 5000,
    accepted_offer_id: acceptedOfferId,
    pickup_lat: -27.435,
    pickup_lng: -65.615,
    dropoff_lat: -27.445,
    dropoff_lng: -65.625,
    created_at: '2026-09-24T10:00:00.000Z',
    matched_at: '2026-09-24T10:05:00.000Z',
    picked_up_at: null,
    delivered_at: null,
    contacts: {
      recipient_name: 'Laura Gómez',
      recipient_phone: '3865123456',
      dropoff_address: 'Belgrano 1220',
      delivery_notes: 'Casa con reja negra',
    },
    offers: [
      {
        id: otherOfferId,
        courier_id: 'courier-uuid-other',
        amount_ars: 2500,
        status: 'rejected',
        courier: {
          display_name: 'Ignacio R.',
          vehicle_type: 'bicycle',
          vehicle_plate: null,
          avatar_url: null,
        },
      },
      {
        id: acceptedOfferId,
        courier_id: courierUserId,
        amount_ars: 1800,
        status: 'accepted',
        courier: {
          display_name: 'Carlos Benítez',
          vehicle_type: 'motorcycle',
          vehicle_plate: 'AB 123 CD',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      },
    ],
  };

  function mockSupabase(userId: string | null, rowData: unknown | null) {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: rowData,
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests') {
        return {
          select: mockSelect,
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId, email: 'test@example.com' } : null },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
  }

  it('rechaza si no hay sesión autenticada con null', async () => {
    mockSupabase(null, mockDbTripRow);
    const trip = await getTripDetails(requestId);
    expect(trip).toBeNull();
  });

  it('H09: el monto acordado proviene estrictamente de la oferta accepted_offer_id ($ 1.800 y no 2.500)', async () => {
    mockSupabase(merchantUserId, mockDbTripRow);
    const trip = await getTripDetails(requestId);
    expect(trip).not.toBeNull();
    if (trip) {
      expect(trip.amountArs).toBe(1800);
      expect(trip.courierName).toBe('Carlos Benítez');
      expect(trip.vehicleType).toBe('motorcycle');
      expect(trip.licensePlate).toBe('AB 123 CD');
    }
  });

  it('H09: expone datos protegidos (contactos y dirección exacta) tras matched para actores autorizados', async () => {
    mockSupabase(courierUserId, mockDbTripRow);
    const trip = await getTripDetails(requestId);
    expect(trip).not.toBeNull();
    if (trip) {
      expect(trip.recipientName).toBe('Laura Gómez');
      expect(trip.recipientPhone).toBe('3865123456');
      expect(trip.dropoffAddress).toBe('Belgrano 1220');
      expect(trip.deliveryNotes).toBe('Casa con reja negra');
      expect(trip.pickupAddress).toBe('San Martín 450, Aguilares');
    }
  });

  it('H09: en estado previo a matched (published), NO revela contactos ni dirección exacta', async () => {
    const publishedRow = {
      ...mockDbTripRow,
      status: 'published' as const,
      accepted_offer_id: null,
      contacts: null,
      offers: [],
    };
    mockSupabase(merchantUserId, publishedRow);
    const trip = await getTripDetails(requestId);
    expect(trip).not.toBeNull();
    if (trip) {
      expect(trip.recipientName).toBeNull();
      expect(trip.recipientPhone).toBeNull();
      expect(trip.dropoffAddress).toBeNull();
      expect(trip.deliveryNotes).toBeNull();
      expect(trip.amountArs).toBeNull();
    }
  });

  it('H09: rechaza acceso si el usuario no es el comercio ni el cadete asignado', async () => {
    mockSupabase(otherUserId, mockDbTripRow);
    const trip = await getTripDetails(requestId);
    expect(trip).toBeNull();
  });

  it('H09: incluye información de cobro en mano (D14: Efectivo y cambio de $ 5.000)', async () => {
    mockSupabase(courierUserId, mockDbTripRow);
    const trip = await getTripDetails(requestId);
    expect(trip).not.toBeNull();
    if (trip) {
      expect(trip.recipientPaymentMethod).toBe('cash');
      expect(trip.needsChange).toBe(true);
      expect(trip.cashChangeAmount).toBe(5000);
    }
  });
});
