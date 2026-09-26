// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { RequestOffersList } from './request-offers-list';
import { requestsCopy } from '../copy';
import type { MerchantOfferItem } from '../types';

// Mock server actions
const mockAcceptOfferAction = vi.fn();
vi.mock('@/features/offers/actions', () => ({
  acceptOfferAction: (...args: unknown[]) => mockAcceptOfferAction(...args),
}));
vi.mock('@/features/offers', () => ({
  acceptOfferAction: (...args: unknown[]) => mockAcceptOfferAction(...args),
}));

// Mock notify
vi.mock('@/ui/notify', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Supabase Realtime (PR76-H05)
let realtimeCallback: ((payload: { eventType: string; new: unknown; old: unknown }) => void) | null = null;
const mockChannel = {
  on: vi.fn((_event: string, _filter: unknown, cb: (payload: { eventType: string; new: unknown; old: unknown }) => void) => {
    realtimeCallback = cb;
    return mockChannel;
  }),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn(),
};
const mockRemoveChannel = vi.fn();

vi.mock('@/lib/supabase/browser', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  })),
}));

describe('T-113 DoD: UI de ofertas en tiempo real y aceptación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtimeCallback = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockRequest = {
    id: 'req-11111111-1111-1111-1111-111111111111',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    approxDistanceKm: '2,5',
    packageType: 'chico' as const,
    recipientPaymentMethod: 'cash' as const,
    needsChange: true,
    cashChangeAmount: 5000,
    status: 'published' as const,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  const initialOffers: MerchantOfferItem[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      courierId: '22222222-2222-2222-2222-222222222222',
      courierName: 'Joaquín R.',
      vehicleType: 'motorcycle',
      amountArs: 1800,
      etaMinutes: 10,
      message: 'Estoy a dos cuadras.',
      licenseStatus: 'verified',
      insuranceStatus: 'verified',
      docLevel: 2,
      createdAt: '2026-09-24T01:00:00.000Z',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      courierId: '44444444-4444-4444-4444-444444444444',
      courierName: 'Micaela T.',
      vehicleType: 'bicycle',
      amountArs: 1400,
      etaMinutes: 20,
      message: null,
      licenseStatus: 'verified',
      insuranceStatus: 'none',
      docLevel: 1,
      createdAt: '2026-09-24T01:05:00.000Z',
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      courierId: '66666666-6666-6666-6666-666666666666',
      courierName: 'Carlos P.',
      vehicleType: 'auto',
      amountArs: 2000,
      etaMinutes: 15,
      message: 'Voy en camino si aceptás.',
      licenseStatus: 'rejected',
      insuranceStatus: 'rejected',
      docLevel: 0,
      createdAt: '2026-09-24T01:02:00.000Z',
    },
  ];

  it('DoD: Ausencia total de estrellas, reviews y calificaciones ("4.9 ★ 182 viajes")', () => {
    const { container } = render(
      <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
    );

    const renderedText = container.textContent ?? '';

    expect(renderedText).not.toMatch(/★|☆|⭐/);
    expect(renderedText).not.toMatch(/4\.9/);
    expect(renderedText).not.toMatch(/182 viajes/i);
    expect(renderedText).not.toMatch(/reseñas?|reviews?|calificaciones?/i);

    expect(screen.getAllByText(/Licencia verificada/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Seguro verificado/i).length).toBeGreaterThan(0);
  });

  it('DoD: Ordenamiento por doc_level (por defecto) y por precio', () => {
    render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

    let cards = screen.getAllByRole('heading', { level: 4 });
    expect(cards[0]?.textContent).toContain('Joaquín R.');
    expect(cards[1]?.textContent).toContain('Micaela T.');
    expect(cards[2]?.textContent).toContain('Carlos P.');

    const priceButton = screen.getByRole('button', { name: /precio/i });
    fireEvent.click(priceButton);

    cards = screen.getAllByRole('heading', { level: 4 });
    expect(cards[0]?.textContent).toContain('Micaela T.');
    expect(cards[1]?.textContent).toContain('Joaquín R.');
    expect(cards[2]?.textContent).toContain('Carlos P.');
  });

  it('DoD: Modal de confirmación de aceptación con desglose de tarifa y medio de pago (C05)', async () => {
    mockAcceptOfferAction.mockResolvedValue({
      ok: true,
      data: {
        status: 'matched',
        requestId: mockRequest.id,
        acceptedOfferId: '11111111-1111-1111-1111-111111111111',
        matchedAt: '2026-09-24T01:30:00Z',
        idempotent: false,
      },
    });

    render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

    const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
    const firstAcceptButton = acceptButtons[0];
    expect(firstAcceptButton).toBeDefined();
    if (firstAcceptButton) {
      fireEvent.click(firstAcceptButton);
    }

    expect(
      screen.getByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
    ).toBeDefined();

    expect(screen.getAllByText(/\$ 1\.800/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Tarifa acordada/i)).toBeDefined();

    expect(screen.getAllByText(/Efectivo/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/necesita cambio/i)).toBeDefined();

    expect(
      screen.getByText(
        /Al aceptar, Joaquín va a ver la dirección de retiro, la de entrega y los datos de tu cliente\. Las otras ofertas se rechazan\./i
      )
    ).toBeDefined();

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).not.toMatch(/★|⭐|4\.9|viajes/i);

    const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockAcceptOfferAction).toHaveBeenCalledWith({
        offerId: '11111111-1111-1111-1111-111111111111',
      });
    });
  });

  it('DoD: Manejo de error ALREADY_MATCHED al aceptar', async () => {
    mockAcceptOfferAction.mockResolvedValue({
      ok: false,
      code: 'ALREADY_MATCHED',
    });

    render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

    const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
    const firstAcceptButton = acceptButtons[0];
    expect(firstAcceptButton).toBeDefined();
    if (firstAcceptButton) {
      fireEvent.click(firstAcceptButton);
    }

    const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Esta solicitud ya fue asignada a otro repartidor o la oferta no está disponible\./i)
      ).toBeDefined();
    });
  });

  it('DoD: La oferta nueva aparece sin recargar la página (Realtime)', async () => {
    const incomingOffer: MerchantOfferItem = {
      id: '77777777-7777-7777-7777-777777777777',
      courierId: '88888888-8888-8888-8888-888888888888',
      courierName: 'Lucas G.',
      vehicleType: 'motorcycle',
      amountArs: 1600,
      etaMinutes: 8,
      message: 'Tengo caja térmica.',
      licenseStatus: 'verified',
      insuranceStatus: 'verified',
      docLevel: 2,
      createdAt: '2026-09-24T01:10:00.000Z',
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [...initialOffers, incomingOffer],
        nextCursor: null,
      }),
    } as Response);

    const { unmount } = render(
      <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
    );

    expect(screen.queryByText('Lucas G.')).toBeNull();
    expect(mockChannel.subscribe).toHaveBeenCalled();

    expect(realtimeCallback).toBeTypeOf('function');
    await act(async () => {
      if (realtimeCallback) {
        realtimeCallback({
          eventType: 'INSERT',
          new: incomingOffer,
          old: null,
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Lucas G.')).toBeDefined();
      expect(screen.getByText('$ 1.600')).toBeDefined();
    });

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('PR82-H20: ante HTTP 500 conserva las ofertas previas y muestra alerta con botón Reintentar', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DATABASE_ERROR' }),
    } as Response);

    render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    expect(screen.getByText(requestsCopy.offers.errorLoadingOffers)).toBeDefined();
    expect(screen.getByText(requestsCopy.offers.errorDescription)).toBeDefined();
    expect(screen.getByRole('button', { name: requestsCopy.offers.retryButton })).toBeDefined();

    // Las ofertas previas se mantienen en pantalla
    expect(screen.getByText('Joaquín R.')).toBeDefined();
  });

  it('PR82-H20: ante HTTP 500 sin ofertas previas muestra alerta de error y NO el mensaje de esperando ofertas', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DATABASE_ERROR' }),
    } as Response);

    render(<RequestOffersList request={mockRequest} initialOffers={[]} />);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    expect(screen.getByText(requestsCopy.offers.errorLoadingOffers)).toBeDefined();
    expect(screen.getByRole('button', { name: requestsCopy.offers.retryButton })).toBeDefined();

    // NO debe mostrar la tarjeta de esperando ofertas
    expect(screen.queryByText(requestsCopy.offers.waitingOffers)).toBeNull();
  });

  it('PR82-H28: muestra el botón "Cargar más" si initialNextCursor existe y lo oculta si es null', () => {
    const cursor = {
      createdAt: '2026-09-26T12:00:00.000Z',
      id: '22222222-2222-2222-2222-222222222222',
    };

    const { unmount } = render(
      <RequestOffersList
        request={mockRequest}
        initialOffers={initialOffers}
        initialNextCursor={null}
      />
    );

    expect(screen.queryByRole('button', { name: requestsCopy.offers.loadMore })).toBeNull();
    unmount();

    render(
      <RequestOffersList
        request={mockRequest}
        initialOffers={initialOffers}
        initialNextCursor={cursor}
      />
    );

    expect(screen.getByRole('button', { name: requestsCopy.offers.loadMore })).toBeDefined();
  });

  it('PR82-H28: al hacer clic en "Cargar más" recupera ofertas y el ordenamiento aplica sobre todas las ofertas cargadas', async () => {
    const cursor = {
      createdAt: '2026-09-26T12:00:00.000Z',
      id: '22222222-2222-2222-2222-222222222222',
    };

    const page2Offer: MerchantOfferItem = {
      id: '99999999-9999-9999-9999-999999999999',
      courierId: '88888888-8888-8888-8888-888888888888',
      courierName: 'Esteban Q.',
      vehicleType: 'auto',
      amountArs: 900,
      etaMinutes: 10,
      message: null,
      licenseStatus: 'verified',
      insuranceStatus: 'none',
      docLevel: 1,
      createdAt: '2026-09-26T11:40:00.000Z',
    };

    render(
      <RequestOffersList
        request={mockRequest}
        initialOffers={initialOffers}
        initialNextCursor={cursor}
      />
    );

    const loadMoreBtn = screen.getByRole('button', { name: requestsCopy.offers.loadMore });
    expect(loadMoreBtn).toBeDefined();

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [page2Offer],
        nextCursor: null,
      }),
    } as Response);

    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Esteban Q.')).toBeDefined();
    });

    // Ordenar por precio: Esteban Q. ($ 900) debe estar primero
    const priceSortBtn = screen.getByRole('button', { name: /precio/i });
    fireEvent.click(priceSortBtn);

    const offerHeadings = screen.getAllByRole('heading', { level: 4 });
    expect(offerHeadings[0]?.textContent).toBe('Esteban Q.');
  });
});
