import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CanonicalMerchantRequestDetailPage from './page';

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: () => mockNotFound(),
}));

const mockGetUser = vi.fn();
vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

const mockGetMerchantRequestWithOffers = vi.fn();
vi.mock('@/features/requests/server', () => ({
  getMerchantRequestWithOffers: (...args: unknown[]) =>
    mockGetMerchantRequestWithOffers(...args),
}));

vi.mock('@/features/requests', () => ({
  RequestOffersList: () => <div data-testid="request-offers-list" />,
}));

describe('T-359: CanonicalMerchantRequestDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'merchant-123' } },
    });
  });

  it('redirige al login si no hay usuario autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(
      CanonicalMerchantRequestDetailPage({
        params: Promise.resolve({ id: 'req-1' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('llama a notFound si la solicitud no existe', async () => {
    mockGetMerchantRequestWithOffers.mockResolvedValue(null);

    await expect(
      CanonicalMerchantRequestDetailPage({
        params: Promise.resolve({ id: 'req-404' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('redirige a /trips/[id] si la solicitud persistida ya está en estado matched', async () => {
    mockGetMerchantRequestWithOffers.mockResolvedValue({
      request: {
        id: 'req-matched-1',
        status: 'matched',
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Norte',
      },
      offers: [],
      nextOffersCursor: null,
    });

    await expect(
      CanonicalMerchantRequestDetailPage({
        params: Promise.resolve({ id: 'req-matched-1' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/trips/req-matched-1');
  });

  it('redirige a /trips/[id] si la solicitud persistida está en in_transit', async () => {
    mockGetMerchantRequestWithOffers.mockResolvedValue({
      request: {
        id: 'req-transit-1',
        status: 'in_transit',
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Norte',
      },
      offers: [],
      nextOffersCursor: null,
    });

    await expect(
      CanonicalMerchantRequestDetailPage({
        params: Promise.resolve({ id: 'req-transit-1' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/trips/req-transit-1');
  });

  it('redirige a /trips/[id] si la solicitud persistida está en delivered', async () => {
    mockGetMerchantRequestWithOffers.mockResolvedValue({
      request: {
        id: 'req-deliv-1',
        status: 'delivered',
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Norte',
      },
      offers: [],
      nextOffersCursor: null,
    });

    await expect(
      CanonicalMerchantRequestDetailPage({
        params: Promise.resolve({ id: 'req-deliv-1' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/trips/req-deliv-1');
  });

  it('renderiza la lista de ofertas si la solicitud está en estado published', async () => {
    mockGetMerchantRequestWithOffers.mockResolvedValue({
      request: {
        id: 'req-pub-1',
        status: 'published',
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Norte',
      },
      offers: [],
      nextOffersCursor: null,
    });

    const jsx = await CanonicalMerchantRequestDetailPage({
      params: Promise.resolve({ id: 'req-pub-1' }),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(jsx).toBeDefined();
  });
});

