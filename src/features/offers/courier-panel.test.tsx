import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { CourierFeed } from './components/courier-feed';
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
    packageType: 'chico',
    recipientPaymentMethod: 'cash',
    needsChange: true,
    publishedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 27 * 60 * 1000).toISOString(),
    hasMyOffer: false,
    myOfferAmountArs: null,
  };

  it('DoD 1: Un repartidor pending ve la pantalla "en revisión"', async () => {
    render(
      <CourierFeed
        courierStatus="pending"
        isAvailable={false}
        requests={[]}
        minOfferArs={1000}
      />
    );

    // La vista de revisión se carga con next/dynamic (hotfix T-325): se espera a que monte.
    expect(await screen.findByText(/estamos revisando tus datos/i)).toBeDefined();
    expect(screen.getByText(/te avisamos por acá y por notificación/i)).toBeDefined();
    expect(screen.queryByText(/solicitudes abiertas/i)).toBeNull();
    // PR242-H02: dentro del feed no hay CTA hacia el propio feed.
    expect(screen.queryByRole('button', { name: /Ir al panel de repartidor/i })).toBeNull();
  });

  describe('Hotfix T-325: el feed pending muestra los documentos reales, no una lista fija', () => {
    const MANDATORY = [
      { kind: 'dni_front', status: 'submitted' },
      { kind: 'dni_back', status: 'submitted' },
      { kind: 'selfie', status: 'submitted' },
      { kind: 'avatar', status: 'submitted' },
    ] as const;

    function rowOf(label: RegExp) {
      return screen.getByText(label).closest('div[class*="flex items-center justify-between"]');
    }

    it('licencia y seguro enviados figuran cargados ("Listo"), nunca "No cargada"', async () => {
      render(
        <CourierFeed
          courierStatus="pending"
          isAvailable={false}
          requests={[]}
          minOfferArs={1000}
          documents={[
            ...MANDATORY,
            { kind: 'license', status: 'submitted' },
            { kind: 'insurance', status: 'verified' },
          ]}
        />
      );

      await screen.findByText(/estamos revisando tus datos/i);
      expect(rowOf(/Licencia/)?.textContent).toContain('Listo');
      expect(rowOf(/Seguro/)?.textContent).toContain('Listo');
      expect(screen.queryByText('No cargada')).toBeNull();
    });

    it('sin licencia ni seguro figuran como opcionales ausentes', async () => {
      render(
        <CourierFeed
          courierStatus="pending"
          isAvailable={false}
          requests={[]}
          minOfferArs={1000}
          documents={[...MANDATORY]}
        />
      );

      await screen.findByText(/estamos revisando tus datos/i);
      expect(rowOf(/Licencia/)?.textContent).toContain('No cargado (opcional)');
      expect(rowOf(/Seguro/)?.textContent).toContain('No cargado (opcional)');
    });

    it('sin documentos persistidos no inventa obligatorios cargados', async () => {
      render(
        <CourierFeed
          courierStatus="pending"
          isAvailable={false}
          requests={[]}
          minOfferArs={1000}
          documents={[]}
        />
      );

      await screen.findByText(/estamos revisando tus datos/i);
      expect(rowOf(/DNI frente y dorso/)?.textContent).toContain('Pendiente');
      expect(rowOf(/Selfie de seguridad/)?.textContent).toContain('Pendiente');
      expect(screen.queryByText('Cargado')).toBeNull();
    });
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
      packageType: 'mediano',
      recipientPaymentMethod: 'transfer',
      needsChange: false,
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
        nextCursor: null,
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
    // NO debe mostrar el empty state común de feed vacío
    expect(screen.queryByText(OFFERS_COPY.emptyFeedTitle)).toBeNull();
  });

  it('PR82-H28: muestra el botón "Cargar más" cuando initialNextCursor está presente y oculta cuando es null', () => {
    const cursor = {
      createdAt: '2026-09-26T12:00:00.000Z',
      id: '11111111-1111-1111-1111-111111111111',
    };

    const { unmount } = render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[sampleRequest]}
        initialNextCursor={null}
        minOfferArs={1000}
      />
    );

    expect(screen.queryByRole('button', { name: OFFERS_COPY.loadMore })).toBeNull();
    unmount();

    render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[sampleRequest]}
        initialNextCursor={cursor}
        minOfferArs={1000}
      />
    );

    expect(screen.getByRole('button', { name: OFFERS_COPY.loadMore })).toBeDefined();
  });

  it('PR82-H28: al hacer clic en "Cargar más" carga y agrega la siguiente página de pedidos al feed', async () => {
    const cursor = {
      createdAt: '2026-09-26T12:00:00.000Z',
      id: '11111111-1111-1111-1111-111111111111',
    };

    const page2Request: AvailableRequestItem = {
      id: '22222222-2222-2222-2222-222222222222',
      pickupZoneName: 'Barrio Oeste',
      dropoffZoneName: 'Barrio Este',
      approxDistanceKm: '1,5',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      publishedAt: '2026-09-26T11:00:00.000Z',
      expiresAt: null,
      hasMyOffer: false,
      myOfferAmountArs: null,
    };

    render(
      <CourierFeed
        courierStatus="approved"
        isAvailable={true}
        requests={[sampleRequest]}
        initialNextCursor={cursor}
        minOfferArs={1000}
      />
    );

    const loadMoreBtn = screen.getByRole('button', { name: OFFERS_COPY.loadMore });
    expect(loadMoreBtn).toBeDefined();

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [page2Request],
        nextCursor: null,
      }),
    } as Response);

    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Barrio Oeste/i)).toBeDefined();
    });

    // Como nextCursor fue null, el botón desaparece
    expect(screen.queryByRole('button', { name: OFFERS_COPY.loadMore })).toBeNull();
  });

  it('PR82-H31 / D06 (Control Estático): src/features/offers/index.ts es un slim barrel sin runtime Zod ni exports sin consumidor', () => {
    const indexPath = path.resolve(__dirname, 'index.ts');
    const sourceCode = fs.readFileSync(indexPath, 'utf8');

    expect(sourceCode).not.toContain("export * from './schemas'");
    expect(sourceCode).not.toContain("export * from './copy'");
    expect(sourceCode).not.toContain('submitOfferAction');
    expect(sourceCode).not.toContain('withdrawOfferAction');

    expect(sourceCode).toContain('export type {');
    expect(sourceCode).toContain("from './schemas'");

    expect(sourceCode).toContain('acceptOfferAction');
    expect(sourceCode).toContain("from './actions'");

    expect(sourceCode).toContain('CourierFeed');
    expect(sourceCode).toContain('MyOffersList');

    expect(sourceCode).not.toContain('OfferSheet');
    expect(sourceCode).not.toContain('RequestCard');
    expect(sourceCode).not.toContain('UnderReview');
    expect(sourceCode).not.toContain('FeedSkeleton');
    expect(sourceCode).not.toContain('OFFERS_COPY');
  });

  describe('T-201 / T03: Comportamiento real ante degradación offline en feed y ofertas', () => {
    it('offline inicial: botón real Ofertar disabled y el wrapper real de las requests contiene grayscale-[20%] y opacity-80', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const { container } = render(
        <CourierFeed
          courierStatus="approved"
          isAvailable={true}
          requests={[sampleRequest]}
          minOfferArs={1000}
        />
      );

      const offerButton = screen.getByRole('button', { name: OFFERS_COPY.offerButton });
      expect((offerButton as HTMLButtonElement).disabled).toBe(true);

      const requestsWrapper = container.querySelector('.grayscale-\\[20\\%\\]');
      expect(requestsWrapper).not.toBeNull();
      expect(requestsWrapper?.className).toContain('opacity-80');

      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('transición offline/online: al estar offline en Sheet deshabilita Enviar oferta, submit no llama a onSubmitOffer, y online rehabilita', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const mockOnSubmit = vi.fn().mockResolvedValue({ ok: true });

      const { rerender } = render(
        <OfferSheet
          isOpen={true}
          onClose={vi.fn()}
          request={sampleRequest}
          minOfferArs={1000}
          onSubmitOffer={mockOnSubmit}
          isOffline={false}
        />
      );

      const submitBtn = screen.getByRole('button', { name: OFFERS_COPY.submitOfferButton });
      expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

      // Simular offline
      rerender(
        <OfferSheet
          isOpen={true}
          onClose={vi.fn()}
          request={sampleRequest}
          minOfferArs={1000}
          onSubmitOffer={mockOnSubmit}
          isOffline={true}
        />
      );

      expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

      // Intentar submit offline: enviar el formulario directamente para probar la guarda interna de handleSubmit
      const form = submitBtn.closest('form');
      expect(form).not.toBeNull();
      fireEvent.submit(form as HTMLFormElement);
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(0);
      });

      // Online rehabilita
      rerender(
        <OfferSheet
          isOpen={true}
          onClose={vi.fn()}
          request={sampleRequest}
          minOfferArs={1000}
          onSubmitOffer={mockOnSubmit}
          isOffline={false}
        />
      );
      expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('en CourierFeed real, evento offline deshabilita botón y evento online lo rehabilita', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      render(
        <CourierFeed
          courierStatus="approved"
          isAvailable={true}
          requests={[sampleRequest]}
          minOfferArs={1000}
        />
      );

      const offerButton = screen.getByRole('button', { name: OFFERS_COPY.offerButton });
      expect((offerButton as HTMLButtonElement).disabled).toBe(false);

      // Disparar evento offline
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect((offerButton as HTMLButtonElement).disabled).toBe(true);

      // Disparar evento online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect((offerButton as HTMLButtonElement).disabled).toBe(false);
    });

    it('en estado no disponible, la jerarquía de headings es continua (h1 -> h2 sin salto a h3)', () => {
      render(
        <CourierFeed
          courierStatus="approved"
          isAvailable={false}
          requests={[]}
          minOfferArs={1000}
        />
      );

      const headings = screen.getAllByRole('heading');
      const levels = headings.map((h) => Number(h.tagName.replace(/^H/, '')));
      for (let i = 1; i < levels.length; i++) {
        const current = levels[i];
        const previous = levels[i - 1];
        expect(current).toBeDefined();
        expect(previous).toBeDefined();
        if (current === undefined || previous === undefined) {
          continue;
        }
        expect(current - previous).toBeLessThanOrEqual(1);
      }
      const unavailableHeading = screen.getByRole('heading', { name: OFFERS_COPY.unavailableAlertTitle });
      expect(unavailableHeading.tagName).toBe('H2');
    });

    it('el input de monto de oferta en OfferSheet declara inputmode="numeric"', () => {
      render(
        <OfferSheet
          isOpen={true}
          onClose={vi.fn()}
          request={sampleRequest}
          minOfferArs={1000}
          onSubmitOffer={vi.fn()}
        />
      );

      const amountInput = screen.getByRole('textbox', { name: OFFERS_COPY.amountLabel });
      expect(amountInput.getAttribute('inputmode')).toBe('numeric');
    });
  });
});

