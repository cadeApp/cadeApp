// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  CreateRequestForm: vi.fn((_props: Record<string, unknown>) => null),
  OnlineCouriersIndicator: vi.fn((_props: Record<string, unknown>) => null),
  getActiveZones: vi.fn(),
  getMerchantDefaultPickup: vi.fn(),
  getMaxDropsPerRequest: vi.fn(),
  getOnlineCouriersLiveServer: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock('@/features/requests', () => ({
  CreateRequestForm: mocks.CreateRequestForm,
  OnlineCouriersIndicator: mocks.OnlineCouriersIndicator,
}));
vi.mock('@/features/requests/server', () => ({
  getActiveZones: mocks.getActiveZones,
  getMerchantDefaultPickup: mocks.getMerchantDefaultPickup,
  getMaxDropsPerRequest: mocks.getMaxDropsPerRequest,
}));
vi.mock('@/server/live/online-couriers', () => ({ getOnlineCouriersLiveServer: mocks.getOnlineCouriersLiveServer }));

import CanonicalNewRequestPage from './page';

describe('T-415: repartidores conectados en «Nueva solicitud»', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'merchant-1' } } });
    mocks.getActiveZones.mockResolvedValue([]);
    mocks.getMerchantDefaultPickup.mockResolvedValue(null);
    mocks.getMaxDropsPerRequest.mockResolvedValue(5);
  });
  afterEach(cleanup);

  it('muestra el indicador antes del formulario con el conteo del servidor', async () => {
    mocks.getOnlineCouriersLiveServer.mockResolvedValue({ ok: true, data: { count: 0, windowMinutes: 10 } });
    render(await CanonicalNewRequestPage());
    expect(mocks.OnlineCouriersIndicator.mock.calls[0]?.[0]).toMatchObject({ initial: { count: 0, windowMinutes: 10 } });
    expect(mocks.CreateRequestForm).toHaveBeenCalledTimes(1);
  });

  it('si la lectura falla, el formulario se muestra igual', async () => {
    mocks.getOnlineCouriersLiveServer.mockResolvedValue({ ok: false, error: 'DATABASE_ERROR', status: 500 });
    render(await CanonicalNewRequestPage());
    expect(mocks.OnlineCouriersIndicator.mock.calls[0]?.[0]).toMatchObject({ initial: null });
    expect(mocks.CreateRequestForm).toHaveBeenCalledTimes(1);
  });
});
