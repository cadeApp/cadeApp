// @vitest-environment jsdom
// PR113-H05: prueba del consumidor real del botón de reporte. Vive en esta carpeta privada (`_tests`) porque la ficha
// de T-124 solo autoriza `src/app/trips/[id]/page.tsx` (sin tests al lado) y `src/app/(admin)/admin/incidents/**`.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as serverSupabase from '@/server/supabase/server';
import { getTripDetails } from '@/features/trips/server';
import { ReportIncidentButton } from '@/features/incidents';
import TripDetailPage from '@/app/trips/[id]/page';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/features/trips/server', () => ({
  getTripDetails: vi.fn(),
}));

vi.mock('@/features/trips', () => ({
  TripMerchantContainer: () => <div data-testid="merchant-container" />,
  TripCourierContainer: () => <div data-testid="courier-container" />,
}));

vi.mock('@/features/incidents', () => ({
  ReportIncidentButton: vi.fn(() => <div data-testid="report-incident-button" />),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

type ServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;
type TripDetails = NonNullable<Awaited<ReturnType<typeof getTripDetails>>>;

const MERCHANT_ID = '10000000-0000-4000-8000-000000000001';
const COURIER_ID = '20000000-0000-4000-8000-00000000000a';

function mockSession(userId: string, role: string) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null }),
  };
  vi.mocked(serverSupabase.createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn(() => builder),
  } as unknown as ServerClient);
}

function trip(overrides: Partial<TripDetails>): TripDetails {
  return {
    id: '30000000-0000-4000-8000-000000000123',
    code: 'CA-123',
    status: 'matched',
    merchantId: MERCHANT_ID,
    merchantName: 'Panadería La Espiga',
    merchantPhone: null,
    courierId: COURIER_ID,
    courierName: 'Diego Santillán',
    courierPhone: null,
    vehicleType: 'moto',
    licensePlate: null,
    avatarUrl: null,
    amountArs: 1500,
    pickupAddress: 'San Martín 450',
    pickupZoneName: 'Centro',
    dropoffAddress: 'Belgrano 1220',
    dropoffZoneName: 'Barrio Norte',
    deliveryNotes: null,
    recipientName: 'Juana Gómez',
    recipientPhone: '3865998877',
    recipientPaymentMethod: 'cash',
    needsChange: false,
    cashChangeAmount: null,
    createdAt: '2026-09-27T09:00:00.000Z',
    matchedAt: '2026-09-27T09:05:00.000Z',
    pickedUpAt: null,
    deliveredAt: null,
    ...overrides,
  };
}

async function renderTripPage(tripId: string) {
  render(await TripDetailPage({ params: Promise.resolve({ id: tripId }) }));
}

function renderedButtonProps() {
  return vi.mocked(ReportIncidentButton).mock.calls.map((call) => call[0]);
}

describe('PR113-H05: trips/[id]/page.tsx cablea ReportIncidentButton con datos reales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { status: 'matched', deliveredAt: null },
    { status: 'in_transit', deliveredAt: null },
    { status: 'delivered', deliveredAt: '2026-09-27T10:30:00.000Z' },
  ] as const)(
    'comercio dueño en $status: actorRole merchant, estado y entrega del viaje',
    async ({ status, deliveredAt }) => {
      const current = trip({ id: '30000000-0000-4000-8000-0000000000a1', status, deliveredAt });
      mockSession(MERCHANT_ID, 'merchant');
      vi.mocked(getTripDetails).mockResolvedValue(current);

      await renderTripPage(current.id);

      expect(renderedButtonProps()).toEqual([
        {
          requestId: current.id,
          actorRole: 'merchant',
          tripStatus: status,
          deliveredAt,
          now: expect.any(Number),
        },
      ]);
    }
  );

  it.each([
    { status: 'matched', deliveredAt: null },
    { status: 'in_transit', deliveredAt: null },
    { status: 'delivered', deliveredAt: '2026-09-27T11:45:00.000Z' },
  ] as const)(
    'repartidor asignado en $status: actorRole courier, estado y entrega del viaje',
    async ({ status, deliveredAt }) => {
      const current = trip({ id: '30000000-0000-4000-8000-0000000000c1', status, deliveredAt });
      mockSession(COURIER_ID, 'courier');
      vi.mocked(getTripDetails).mockResolvedValue(current);

      await renderTripPage(current.id);

      expect(renderedButtonProps()).toEqual([
        {
          requestId: current.id,
          actorRole: 'courier',
          tripStatus: status,
          deliveredAt,
          now: expect.any(Number),
        },
      ]);
    }
  );

  it('un admin no recibe camino de reporte', async () => {
    mockSession('90000000-0000-4000-8000-000000000001', 'admin');
    vi.mocked(getTripDetails).mockResolvedValue(trip({}));

    await expect(renderTripPage('30000000-0000-4000-8000-000000000123')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(ReportIncidentButton).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'un comercio que no es dueño', userId: '10000000-0000-4000-8000-0000000000ff', role: 'merchant' },
    { name: 'un repartidor que no es el asignado', userId: '20000000-0000-4000-8000-0000000000ff', role: 'courier' },
  ])('$name no ve el viaje ni el botón', async ({ userId, role }) => {
    mockSession(userId, role);
    vi.mocked(getTripDetails).mockResolvedValue(trip({}));

    await expect(renderTripPage('30000000-0000-4000-8000-000000000123')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(ReportIncidentButton).not.toHaveBeenCalled();
  });
});
