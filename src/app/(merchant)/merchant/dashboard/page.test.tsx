// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  getMerchantRequests: vi.fn(),
  MerchantRequestsList: vi.fn((_props: Record<string, unknown>) => null),
  AnnouncementBanner: vi.fn((_props: Record<string, unknown>) => null),
  getMyAnnouncement: vi.fn(),
  OnlineCouriersIndicator: vi.fn((_props: Record<string, unknown>) => null),
  getOnlineCouriersLiveServer: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  })),
}));
vi.mock('@/features/requests/server', () => ({ getMerchantRequests: mocks.getMerchantRequests }));
vi.mock('@/features/requests', () => ({
  MerchantRequestsList: mocks.MerchantRequestsList,
  OnlineCouriersIndicator: mocks.OnlineCouriersIndicator,
}));
vi.mock('@/server/live/online-couriers', () => ({ getOnlineCouriersLiveServer: mocks.getOnlineCouriersLiveServer }));
vi.mock('@/features/announcements', () => ({ AnnouncementBanner: mocks.AnnouncementBanner }));
vi.mock('@/features/announcements/server', () => ({ getMyAnnouncement: mocks.getMyAnnouncement }));

import MerchantDashboardPage from './page';

const ANNOUNCEMENT = {
  id: '90000000-0000-4000-8000-000000000001',
  title: 'Hoy los viajes múltiples cuestan 1 crédito',
  body: 'Aprovechá la promo de hoy.',
  cta: 'merchant_plan',
};

describe('T-414: banner de novedades en /merchant/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'merchant-1' } }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { profile_id: 'merchant-1', business_name: 'Kiosco' }, error: null });
    mocks.getMerchantRequests.mockResolvedValue({ requests: [], metrics: {} });
    mocks.getOnlineCouriersLiveServer.mockResolvedValue({ ok: true, data: { count: 2, windowMinutes: 10 } });
  });
  afterEach(cleanup);

  it('muestra la novedad vigente antes de las solicitudes', async () => {
    mocks.getMyAnnouncement.mockResolvedValue(ANNOUNCEMENT);
    const { container } = render(await MerchantDashboardPage());
    expect(mocks.AnnouncementBanner).toHaveBeenCalledTimes(1);
    expect(mocks.AnnouncementBanner.mock.calls[0]?.[0]).toMatchObject({ announcement: ANNOUNCEMENT });
    expect(mocks.MerchantRequestsList).toHaveBeenCalledTimes(1);
    expect(container).toBeTruthy();
  });

  it('sin novedad, la home se ve igual', async () => {
    mocks.getMyAnnouncement.mockResolvedValue(null);
    render(await MerchantDashboardPage());
    expect(mocks.AnnouncementBanner).not.toHaveBeenCalled();
    expect(mocks.MerchantRequestsList).toHaveBeenCalledTimes(1);
  });
});

describe('T-415: repartidores conectados en /merchant/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'merchant-1' } }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { profile_id: 'merchant-1', business_name: 'Kiosco' }, error: null });
    mocks.getMerchantRequests.mockResolvedValue({ requests: [], metrics: {} });
    mocks.getMyAnnouncement.mockResolvedValue(null);
  });
  afterEach(cleanup);

  it('lee el conteo en el servidor y se lo pasa al indicador', async () => {
    mocks.getOnlineCouriersLiveServer.mockResolvedValue({ ok: true, data: { count: 2, windowMinutes: 10 } });
    render(await MerchantDashboardPage());
    expect(mocks.getOnlineCouriersLiveServer).toHaveBeenCalledTimes(1);
    expect(mocks.OnlineCouriersIndicator.mock.calls[0]?.[0]).toMatchObject({ initial: { count: 2, windowMinutes: 10 } });
  });

  it('si la lectura del servidor falla, el indicador arranca sin dato', async () => {
    mocks.getOnlineCouriersLiveServer.mockResolvedValue({ ok: false, error: 'DATABASE_ERROR', status: 500 });
    render(await MerchantDashboardPage());
    expect(mocks.OnlineCouriersIndicator.mock.calls[0]?.[0]).toMatchObject({ initial: null });
    expect(mocks.MerchantRequestsList).toHaveBeenCalledTimes(1);
  });
});
