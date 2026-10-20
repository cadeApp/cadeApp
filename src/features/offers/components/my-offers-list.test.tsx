import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { MyOffersList } from './my-offers-list';
import type { CourierOfferItem } from '../schemas';

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

describe('MyOffersList - Navegación SPA a detalle de viaje', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleAcceptedOffer: CourierOfferItem = {
    offerId: 'offer-uuid-1',
    requestId: 'req-uuid-456',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    amountArs: 1500,
    etaMinutes: 15,
    message: null,
    status: 'accepted',
    requestStatus: 'matched',
    createdAt: '2026-09-23T10:00:00Z',
    decidedAt: '2026-09-23T10:05:00Z',
    requestExpiresAt: null,
    approxDistanceKm: '2,5',
  };

  it('debe invocar router.push con la ruta del viaje y NO recargar la página dura', () => {
    render(<MyOffersList initialOffers={[sampleAcceptedOffer]} />);

    // 1. Cambiar a la pestaña de "Aceptadas"
    const acceptedTab = screen.getByRole('button', { name: /aceptadas/i });
    fireEvent.click(acceptedTab);

    // 2. Localizar el botón "Ir al viaje" de la oferta aceptada
    const goToTripBtn = screen.getByRole('button', { name: /ir al viaje/i });
    expect(goToTripBtn).toBeDefined();

    // 3. Simular clic del repartidor
    fireEvent.click(goToTripBtn);

    // 4. Verificación de contrato: router.push debe ser invocado
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(`/trips/${sampleAcceptedOffer.requestId}`);
  });

  it('los tres tabs de estado deben tener un touch target mínimo de 48px (min-h-12)', () => {
    render(<MyOffersList initialOffers={[]} />);

    const pendingTab = screen.getByRole('button', { name: /pendientes/i });
    const acceptedTab = screen.getByRole('button', { name: /aceptadas/i });
    const otherTab = screen.getByRole('button', { name: /otras/i });

    expect(pendingTab.className).toContain('min-h-12');
    expect(acceptedTab.className).toContain('min-h-12');
    expect(otherTab.className).toContain('min-h-12');
  });
});

describe('T-379: matriz de pestañas de MyOffersList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function offer(id: string, overrides: Partial<CourierOfferItem>): CourierOfferItem {
    return {
      offerId: `offer-${id}`,
      requestId: `req-${id}`,
      pickupZoneName: `Origen ${id}`,
      dropoffZoneName: `Destino ${id}`,
      amountArs: 1500,
      etaMinutes: 15,
      message: null,
      status: 'accepted',
      requestStatus: 'matched',
      createdAt: '2026-10-20T10:00:00Z',
      decidedAt: null,
      requestExpiresAt: null,
      approxDistanceKm: null,
      ...overrides,
    };
  }

  const offers: CourierOfferItem[] = [
    offer('pending', { status: 'pending', requestStatus: 'published' }),
    offer('matched', { status: 'accepted', requestStatus: 'matched' }),
    offer('transit', { status: 'accepted', requestStatus: 'in_transit' }),
    offer('delivered', { status: 'accepted', requestStatus: 'delivered' }),
    offer('reqcancelled', { status: 'accepted', requestStatus: 'cancelled' }),
    offer('hidden', { status: 'accepted', requestStatus: null }),
    offer('rejected', { status: 'rejected', requestStatus: 'matched' }),
    // Rechazada en un viaje que después entregó otro repartidor: la etiqueta es la de la oferta, sin enlace.
    offer('lostdelivered', { status: 'rejected', requestStatus: 'delivered' }),
    offer('withdrawn', { status: 'withdrawn', requestStatus: 'published' }),
    offer('expired', { status: 'expired', requestStatus: 'expired' }),
    offer('offercancelled', { status: 'cancelled', requestStatus: null }),
  ];

  /** La tarjeta de la oferta `id`, ubicada por su ruta. */
  function card(id: string): HTMLElement {
    const route = screen.getByText(`Origen ${id} → Destino ${id}`);
    const item = route.closest('li');
    if (!item) throw new Error(`la oferta ${id} no está en un elemento de lista`);
    return item;
  }

  function routesInList(): string[] {
    return screen.queryAllByRole('listitem').map((item) => {
      const heading = within(item).getByRole('heading', { level: 4 });
      return heading.textContent ?? '';
    });
  }

  it('los contadores de cada pestaña coinciden con su lista', () => {
    render(<MyOffersList initialOffers={offers} />);

    expect(screen.getByRole('button', { name: 'Pendientes (1)' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Aceptadas (2)' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Otras (8)' })).toBeDefined();

    expect(routesInList()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^Aceptadas/ }));
    expect(routesInList()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /^Otras/ }));
    expect(routesInList()).toHaveLength(8);
  });

  it('«Aceptadas» muestra solo los viajes activos (matched e in_transit) con «¡Te eligieron!» e «Ir al viaje»', () => {
    render(<MyOffersList initialOffers={offers} />);
    fireEvent.click(screen.getByRole('button', { name: /^Aceptadas/ }));

    expect(routesInList()).toEqual(['Origen matched → Destino matched', 'Origen transit → Destino transit']);
    for (const id of ['matched', 'transit']) {
      expect(within(card(id)).getByText('¡Te eligieron!')).toBeDefined();
      fireEvent.click(within(card(id)).getByRole('button', { name: 'Ir al viaje' }));
      expect(pushMock).toHaveBeenLastCalledWith(`/trips/req-${id}`);
    }
  });

  it('entregado va a «Otras» como «Entregado» con enlace «Ver viaje»', () => {
    render(<MyOffersList initialOffers={offers} />);
    fireEvent.click(screen.getByRole('button', { name: /^Otras/ }));

    const delivered = card('delivered');
    expect(within(delivered).getByText('Entregado')).toBeDefined();
    expect(within(delivered).getByRole('link', { name: 'Ver viaje' }).getAttribute('href')).toBe('/trips/req-delivered');
    expect(within(delivered).queryByText('¡Te eligieron!')).toBeNull();
    expect(within(delivered).queryByRole('button', { name: 'Ir al viaje' })).toBeNull();
  });

  it.each([
    ['reqcancelled', 'Cancelado'],
    ['hidden', 'Estado no disponible'],
  ])('oferta aceptada con solicitud %s va a «Otras» como «%s», sin enlace ni botón de viaje', (id, label) => {
    render(<MyOffersList initialOffers={offers} />);
    fireEvent.click(screen.getByRole('button', { name: /^Otras/ }));

    const item = card(id);
    expect(within(item).getByText(label)).toBeDefined();
    expect(within(item).queryByRole('link')).toBeNull();
    expect(within(item).queryByRole('button', { name: 'Ir al viaje' })).toBeNull();
  });

  it.each([
    ['rejected', 'Rechazada'],
    ['lostdelivered', 'Rechazada'],
    ['withdrawn', 'Retirada'],
    ['expired', 'Vencida'],
    ['offercancelled', 'Cancelada'],
  ])('oferta %s va a «Otras» con la etiqueta de la oferta («%s»), no la de la solicitud', (id, label) => {
    render(<MyOffersList initialOffers={offers} />);
    fireEvent.click(screen.getByRole('button', { name: /^Otras/ }));

    const item = card(id);
    expect(within(item).getByText(label)).toBeDefined();
    expect(within(item).queryByText('Entregado')).toBeNull();
    expect(within(item).queryByText('Estado no disponible')).toBeNull();
    expect(within(item).queryByRole('link')).toBeNull();
  });
});
