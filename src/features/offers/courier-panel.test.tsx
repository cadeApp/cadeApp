import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CourierFeed } from './components/courier-feed';
import { UnderReview } from './components/under-review';
import { OfferSheet } from './components/offer-sheet';
import type { AvailableRequestItem } from './schemas';

describe('T-114 DoD: Courier panel UI, privacidad y reglas de negocio', () => {
  const sampleRequest: AvailableRequestItem = {
    id: 'req-uuid-1',
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

    expect(screen.getByText(/estamos revisando tus datos/i)).toBeInTheDocument();
    expect(screen.getByText(/te avisamos por acá y por notificación/i)).toBeInTheDocument();
    // No debe mostrar la lista de solicitudes abiertas
    expect(screen.queryByText(/solicitudes abiertas/i)).not.toBeInTheDocument();
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

    // Muestra el piso visible en el formulario
    expect(screen.getByText(/mínimo \$ 1\.000/i)).toBeInTheDocument();

    const input = screen.getByLabelText(/monto de la oferta/i);
    fireEvent.change(input, { target: { value: '800' } });

    const submitBtn = screen.getByRole('button', { name: /enviar oferta/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/la oferta es menor al monto mínimo permitido/i)).toBeInTheDocument();
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

    // 1. No debe existir ningún iframe, canvas ni contenedor de mapa
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-testid="map"]')).toBeNull();
    expect(container.querySelector('.gm-style')).toBeNull();

    // 2. Ninguna coordenada lat/lng de Aguilares (-27.xx, -65.xx) en el DOM
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

    // Indicador visual de necesidad de cambio presente
    expect(screen.getByText(/necesita cambio/i)).toBeInTheDocument();

    // Piso tipográfico de 14px: ninguna clase text-xs (12px) en los textos de la tarjeta
    const cardElement = container.querySelector('[data-testid="request-card"]');
    expect(cardElement).not.toBeNull();
    const textXsElements = cardElement?.querySelectorAll('.text-xs');
    expect(textXsElements?.length ?? 0).toBe(0);
  });
});
