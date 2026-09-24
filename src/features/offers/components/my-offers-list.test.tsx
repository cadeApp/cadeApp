import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
