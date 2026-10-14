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
  getUser: vi.fn(),
}));

vi.mock('@/features/offers', () => ({ CourierFeed: mocks.CourierFeed }));
vi.mock('@/features/offers/server', () => ({
  getCourierStatusAndAvailability: mocks.getCourierStatusAndAvailability,
  getPlatformMinOfferArs: mocks.getPlatformMinOfferArs,
  getAvailableRequests: mocks.getAvailableRequests,
}));
vi.mock('@/features/courier-onboarding/server', () => ({
  getCourierDocumentsStatus: mocks.getCourierDocumentsStatus,
}));
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
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'courier-123' } }, error: null });
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
});
