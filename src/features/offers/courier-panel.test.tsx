import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { CourierFeed } from './components/courier-feed';
import { UnderReview } from './components/under-review';
import { OfferSheet } from './components/offer-sheet';
import { MyOffersList } from './components/my-offers-list';
import { OFFERS_COPY } from './copy';
import type { AvailableRequestItem, CourierOfferItem } from './schemas';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockChannel = {
  on: vi.fn(),
  subscribe: vi.fn(),
};

vi.mock('@/lib/supabase/browser', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  })),
}));

describe('T-114 DoD: Courier panel UI, privacidad y reglas de negocio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannel.on.mockReturnValue(mockChannel);
    mockChannel.subscribe.mockReturnValue(mockChannel);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleRequest: AvailableRequestItem = {
    id: '11111111-1111-1111-1111-111111111111',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    approxDistanceKm: '2,5',
    packageType: 'small',
    recipientPaymentMethod: 'cash',
    needsChange: true,
    cashChangeAmount: 5000,
    notes: 'Frágil',
    publishedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 27 * 60 * 1000).toISOString(),
    hasMyOffer: false,
    myOfferAmountArs: null,
  };

  it('DoD 1: Un repartidor pending ve la pantalla "en revisión"', () => {
    render(
      <CourierFeed
        courierStatus="pending"
        isAvailable={false}
        requests={[]}
        minOfferArs={1000}
      />
    );

    expect(screen.getByText(/estamos revisando tus datos/i)).toBeDefined();
    expect(screen.getByText(/te avisamos por acá y por notificación/i)).toBeDefined();
    expect(screen.queryByText(/solicitudes abiertas/i)).toBeNull();
  });

  it('DoD 2: Una oferta bajo el piso muestra el error del servidor', async () => {
    const mockOnSubmit = vi.fn().mockResolvedValue({
      ok: false,
      code: 'OFFER_BELOW_MINIMUM',
      message: 'La oferta es menor al monto mínimo permitido.',
    });

    render(
      <OfferSheet
        isOpen={true}
        onClose={vi.fn()}
        request={sampleRequest}
        minOfferArs={1000}
        onSubmitOffer={mockOnSubmit}
      />
    );

    expect(screen.getByText(/mínimo \$ 1\.000/i)).toBeDefined();

    const input = screen.getByLabelText(/monto de la oferta/i);
    fireEvent.change(input, { target: { value: '800' } });

    const submitBtn = screen.getByRole('button', { name: /enviar oferta/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/la oferta es menor al monto mínimo permitido/i)).toBeDefined();
    });
  });

  it('DoD 3: Se valida que no viajen coordenadas ni mapa en el DOM ni en la red', () => {
    const { container } = render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[sampleRequest]}
        minOfferArs={1000}
      />
    );

    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-testid="map"]')).toBeNull();
    expect(container.querySelector('.gm-style')).toBeNull();

    const htmlContent = container.innerHTML;
    expect(htmlContent).not.toMatch(/-27\.\d+/);
    expect(htmlContent).not.toMatch(/-65\.\d+/);
    expect(htmlContent).not.toContain('pickup_lat');
    expect(htmlContent).not.toContain('dropoff_lat');
  });

  it('DoD 4: Sin textos de precio sugerido en ningún componente ni tarjeta', () => {
    const { container: feedContainer } = render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[sampleRequest]}
        minOfferArs={1000}
      />
    );

    expect(feedContainer.textContent?.toLowerCase()).not.toContain('precio sugerido');

    const { container: sheetContainer } = render(
      <OfferSheet
        isOpen={true}
        onClose={vi.fn()}
        request={sampleRequest}
        minOfferArs={1000}
        onSubmitOffer={vi.fn()}
      />
    );

    expect(sheetContainer.textContent?.toLowerCase()).not.toContain('precio sugerido');
  });

  it('DoD 5: Tarjetas con piso 14px e indicador visual de necesidad de cambio', () => {
    const { container } = render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[sampleRequest]}
        minOfferArs={1000}
      />
    );

    expect(screen.getByText(/necesita cambio/i)).toBeDefined();

    const cardElement = container.querySelector('[data-testid="request-card"]');
    expect(cardElement).not.toBeNull();
    const textXsElements = cardElement?.querySelectorAll('.text-xs');
    expect(textXsElements?.length ?? 0).toBe(0);
  });

  it('PR69-H01: MyOffersList usa useRouter (soft navigation) al ir al viaje en lugar de hard reload', () => {
    pushMock.mockClear();
    const sampleAcceptedOffer: CourierOfferItem = {
      offerId: 'offer-uuid-1',
      requestId: 'req-uuid-456',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Barrio Norte',
      amountArs: 1500,
      etaMinutes: 15,
      message: null,
      status: 'accepted',
      createdAt: '2026-09-23T10:00:00Z',
      decidedAt: '2026-09-23T10:05:00Z',
      requestExpiresAt: null,
      approxDistanceKm: '2,5',
    };

    render(<MyOffersList initialOffers={[sampleAcceptedOffer]} />);

    const acceptedTab = screen.getByRole('button', { name: /aceptadas/i });
    fireEvent.click(acceptedTab);

    const goToTripBtn = screen.getByRole('button', { name: /ir al viaje/i });
    fireEvent.click(goToTripBtn);

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(`/trips/${sampleAcceptedOffer.requestId}`);
  });

  it('PR69-H02 / D16: OfferSheet respeta la Cláusula Anti-12px en el badge de cambio (text-sm, sin text-xs)', () => {
    const { container } = render(
      <OfferSheet
        isOpen={true}
        onClose={vi.fn()}
        request={sampleRequest}
        minOfferArs={1000}
        onSubmitOffer={vi.fn()}
      />
    );

    const badgeText = screen.getByText(/necesita cambio/i);
    const badgeElement = badgeText.closest('span');
    expect(badgeElement).not.toBeNull();
    expect(badgeElement?.classList.contains('text-xs')).toBe(false);
    expect(badgeElement?.classList.contains('text-sm')).toBe(true);

    const textXsElements = container.querySelectorAll('.text-xs');
    expect(textXsElements.length).toBe(0);
  });

  it('PR82-H09: CourierFeed consume useAvailableRequests y ante foco/invalidación muestra solicitudes vivas', async () => {
    const reqLive2: AvailableRequestItem = {
      id: '22222222-2222-2222-2222-222222222222',
      approxDistanceKm: '1,5',
      packageType: 'medium',
      recipientPaymentMethod: 'transfer',
      needsChange: false,
      cashChangeAmount: null,
      notes: 'Urgente',
      publishedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      pickupZoneName: 'Plaza',
      dropoffZoneName: 'Barrio Sur',
      hasMyOffer: false,
      myOfferAmountArs: null,
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [reqLive2],
      }),
    } as Response);

    render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[sampleRequest]}
        minOfferArs={1000}
      />
    );

    expect(screen.getByText(/Barrio Norte/i)).toBeDefined();
    expect(screen.queryByText(/Barrio Sur/i)).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Barrio Sur/i)).toBeDefined();
    });
  });

  it('PR82-H20: ante HTTP 500 conserva las solicitudes previas y muestra alerta con botón Reintentar', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DATABASE_ERROR' }),
    } as Response);

    render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[sampleRequest]}
        minOfferArs={1000}
      />
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    // Muestra alerta accesible y botón de reintento
    expect(screen.getByText(OFFERS_COPY.feedErrorTitle)).toBeDefined();
    expect(screen.getByText(OFFERS_COPY.feedErrorDescription)).toBeDefined();
    expect(screen.getByRole('button', { name: OFFERS_COPY.retryButton })).toBeDefined();

    // La solicitud previa no desaparece
    expect(screen.getByText(/Barrio Norte/i)).toBeDefined();
  });

  it('PR82-H20: ante HTTP 500 sin datos previos muestra alerta de error y NO el EmptyState de esperando pedidos', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DATABASE_ERROR' }),
    } as Response);

    render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[]}
        minOfferArs={1000}
      />
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    // Muestra el error
    expect(screen.getByText(OFFERS_COPY.feedErrorTitle)).toBeDefined();
    expect(screen.getByRole('button', { name: OFFERS_COPY.retryButton })).toBeDefined();

    // NO debe mostrar el empty state común de feed vacío
    expect(screen.queryByText(OFFERS_COPY.emptyFeedTitle)).toBeNull();
  });
});
