// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  CourierFeed: vi.fn((_props: Record<string, unknown>) => null),
  getCourierStatusAndAvailability: vi.fn(),
  getPlatformMinOfferArs: vi.fn(),
  getAvailableRequests: vi.fn(),
  getCourierDocumentsStatus: vi.fn(),
  getActiveTripsForCourier: vi.fn(),
  getUser: vi.fn(),
  AnnouncementBanner: vi.fn((_props: Record<string, unknown>) => null),
  getMyAnnouncement: vi.fn(),
}));

vi.mock('@/features/offers', () => ({ CourierFeed: mocks.CourierFeed }));
vi.mock('@/features/offers/server', () => ({
  getCourierStatusAndAvailability: mocks.getCourierStatusAndAvailability,
  getPlatformMinOfferArs: mocks.getPlatformMinOfferArs,
  getAvailableRequests: mocks.getAvailableRequests,
}));
vi.mock('@/features/trips/server', () => ({
  getActiveTripsForCourier: mocks.getActiveTripsForCourier,
}));
vi.mock('@/features/courier-onboarding/server', () => ({
  getCourierDocumentsStatus: mocks.getCourierDocumentsStatus,
}));
vi.mock('@/features/announcements', () => ({ AnnouncementBanner: mocks.AnnouncementBanner }));
vi.mock('@/features/announcements/server', () => ({ getMyAnnouncement: mocks.getMyAnnouncement }));
vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

import CourierFeedPage from './page';

/** Props con los que la página renderizó `CourierFeed`. */
async function renderPage() {
  render(await CourierFeedPage());
  expect(mocks.CourierFeed).toHaveBeenCalledTimes(1);
  return mocks.CourierFeed.mock.calls[0]?.[0] ?? {};
}

describe('Hotfix T-325 / PR242-H01: /courier/feed usa los documentos persistidos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformMinOfferArs.mockResolvedValue(1000);
    mocks.getAvailableRequests.mockResolvedValue({ requests: [], nextCursor: null });
    mocks.getActiveTripsForCourier.mockResolvedValue({ courierId: 'courier-123', trips: [] });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'courier-123' } }, error: null });
    mocks.getMyAnnouncement.mockResolvedValue(null);
  });
  afterEach(cleanup);

  it('pending: consulta los documentos del usuario y pasa a CourierFeed exactamente ese array', async () => {
    const documents = [
      { kind: 'license', status: 'submitted' },
      { kind: 'insurance', status: 'verified' },
    ];
    mocks.getCourierStatusAndAvailability.mockResolvedValue({
      status: 'pending',
      available: false,
    });
    mocks.getCourierDocumentsStatus.mockResolvedValue(documents);

    const props = await renderPage();

    expect(mocks.getCourierDocumentsStatus).toHaveBeenCalledTimes(1);
    expect(mocks.getCourierDocumentsStatus).toHaveBeenCalledWith('courier-123');
    expect(props.documents).toBe(documents);
    expect(props.courierStatus).toBe('pending');
  });

  it('approved: no consulta documentos y documents queda undefined', async () => {
    mocks.getCourierStatusAndAvailability.mockResolvedValue({
      status: 'approved',
      available: true,
    });

    const props = await renderPage();

    expect(mocks.getCourierDocumentsStatus).not.toHaveBeenCalled();
    expect(props.documents).toBeUndefined();
  });

  it('PR242-H03: un error de auth no se convierte en documentos vacíos', async () => {
    mocks.getCourierStatusAndAvailability.mockResolvedValue({
      status: 'pending',
      available: false,
    });
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired: token sb-secret-detail' },
    });

    const rejection = CourierFeedPage();

    await expect(rejection).rejects.toThrow('Error al verificar sesión del repartidor');
    await expect(rejection).rejects.not.toThrow(/JWT|sb-secret/);
    expect(mocks.getCourierDocumentsStatus).not.toHaveBeenCalled();
    expect(mocks.CourierFeed).not.toHaveBeenCalled();
  });

  it('approved: consulta getActiveTripsForCourier y pasa courierId e initialActiveTrips a CourierFeed', async () => {
    const activeTrips = [
      {
        id: 'trip-1',
        status: 'matched' as const,
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Sur',
        dropsCount: 1,
        amountArs: 2500,
        matchedAt: '2026-10-15T00:00:00Z',
      },
    ];
    mocks.getCourierStatusAndAvailability.mockResolvedValue({
      status: 'approved',
      available: true,
    });
    mocks.getActiveTripsForCourier.mockResolvedValue({
      courierId: 'courier-123',
      trips: activeTrips,
    });

    const props = await renderPage();

    expect(mocks.getActiveTripsForCourier).toHaveBeenCalledTimes(1);
    expect(props.courierId).toBe('courier-123');
    expect(props.initialActiveTrips).toBe(activeTrips);
  });

  it('pending: no consulta getActiveTripsForCourier', async () => {
    mocks.getCourierStatusAndAvailability.mockResolvedValue({
      status: 'pending',
      available: false,
    });
    mocks.getCourierDocumentsStatus.mockResolvedValue([]);

    const props = await renderPage();

    expect(mocks.getActiveTripsForCourier).not.toHaveBeenCalled();
    expect(props.courierId).toBeUndefined();
    expect(props.initialActiveTrips).toBeUndefined();
  });

  it('T-360: un error en la consulta de viajes activos de SSR rechaza la promesa y no pasa array vacío', async () => {
    mocks.getCourierStatusAndAvailability.mockResolvedValue({
      status: 'approved',
      available: true,
    });
    mocks.getActiveTripsForCourier.mockRejectedValue(
      new Error('Error al consultar solicitudes activas')
    );

    await expect(CourierFeedPage()).rejects.toThrow('Error al consultar solicitudes activas');
    expect(mocks.CourierFeed).not.toHaveBeenCalled();
  });
});

describe('T-414: banner de novedades en /courier/feed', () => {
  const ANNOUNCEMENT = {
    id: '90000000-0000-4000-8000-000000000001',
    title: 'Nueva tarifa sugerida',
    body: 'Actualizamos las referencias.',
    cta: 'courier_feed',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformMinOfferArs.mockResolvedValue(1000);
    mocks.getAvailableRequests.mockResolvedValue({ requests: [], nextCursor: null });
    mocks.getActiveTripsForCourier.mockResolvedValue({ courierId: 'courier-123', trips: [] });
    mocks.getCourierStatusAndAvailability.mockResolvedValue({ status: 'approved', available: true });
  });
  afterEach(cleanup);

  it('muestra la novedad vigente arriba del feed', async () => {
    mocks.getMyAnnouncement.mockResolvedValue(ANNOUNCEMENT);
    await renderPage();
    expect(mocks.getMyAnnouncement).toHaveBeenCalledTimes(1);
    expect(mocks.AnnouncementBanner).toHaveBeenCalledTimes(1);
    expect(mocks.AnnouncementBanner.mock.calls[0]?.[0]).toMatchObject({ announcement: ANNOUNCEMENT });
  });

  it('sin novedad no hay banner y el feed se ve igual', async () => {
    mocks.getMyAnnouncement.mockResolvedValue(null);
    await renderPage();
    expect(mocks.AnnouncementBanner).not.toHaveBeenCalled();
  });
});

