import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    const { container } = render(jsx);
    expect(screen.getByTestId('request-offers-list')).toBeDefined();
    expect(container).toBeDefined();
  });

  it('renderiza vista terminal para solicitud cancelled con badge y enlace a historial sin RequestOffersList', async () => {
    mockGetMerchantRequestWithOffers.mockResolvedValue({
      request: {
        id: 'req-cancelled-1',
        status: 'cancelled',
        pickupZoneName: 'Barrio Centro',
        dropoffZoneName: 'Barrio Norte',
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        cashChangeAmount: null,
        notes: null,
        expiresAt: null,
        createdAt: '2026-10-15T00:00:00Z',
        acceptedOfferId: null,
      },
      offers: [],
      nextOffersCursor: null,
    });

    const jsx = await CanonicalMerchantRequestDetailPage({
      params: Promise.resolve({ id: 'req-cancelled-1' }),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    render(jsx);

    expect(screen.getByText('Cancelada')).toBeDefined();
    expect(screen.getByRole('link', { name: /ver historial/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /ver historial/i }).getAttribute('href')).toBe('/merchant/history');
    expect(screen.queryByTestId('request-offers-list')).toBeNull();
  });

  it('renderiza vista terminal para solicitud expired con badge y enlace a historial sin RequestOffersList', async () => {
    mockGetMerchantRequestWithOffers.mockResolvedValue({
      request: {
        id: 'req-expired-1',
        status: 'expired',
        pickupZoneName: 'Barrio Centro',
        dropoffZoneName: 'Barrio Sur',
        packageType: 'mediano',
        recipientPaymentMethod: 'transfer',
        needsChange: false,
        cashChangeAmount: null,
        notes: null,
        expiresAt: '2026-10-14T23:00:00Z',
        createdAt: '2026-10-14T22:30:00Z',
        acceptedOfferId: null,
      },
      offers: [],
      nextOffersCursor: null,
    });

    const jsx = await CanonicalMerchantRequestDetailPage({
      params: Promise.resolve({ id: 'req-expired-1' }),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    render(jsx);

    expect(screen.getByText('Expirada')).toBeDefined();
    expect(screen.getByRole('link', { name: /ver historial/i })).toBeDefined();
    expect(screen.queryByTestId('request-offers-list')).toBeNull();
  });

  it('renderiza estado no publicado para solicitud draft sin selector ni RequestOffersList', async () => {
    mockGetMerchantRequestWithOffers.mockResolvedValue({
      request: {
        id: 'req-draft-1',
        status: 'draft',
        pickupZoneName: 'Barrio Centro',
        dropoffZoneName: 'Barrio Este',
        packageType: 'grande',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        cashChangeAmount: null,
        notes: null,
        expiresAt: null,
        createdAt: '2026-10-15T00:00:00Z',
        acceptedOfferId: null,
      },
      offers: [],
      nextOffersCursor: null,
    });

    const jsx = await CanonicalMerchantRequestDetailPage({
      params: Promise.resolve({ id: 'req-draft-1' }),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    render(jsx);

    expect(screen.getByRole('heading', { name: /solicitud en borrador/i })).toBeDefined();
    expect(screen.getByText('Borrador')).toBeDefined();
    expect(screen.queryByTestId('request-offers-list')).toBeNull();
    expect(screen.queryByRole('button', { name: /aceptar/i })).toBeNull();
  });
});

