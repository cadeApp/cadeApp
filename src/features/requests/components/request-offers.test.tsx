// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RequestOffersList } from './request-offers-list';
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
      id: 'off-1',
      courierId: 'courier-1',
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
      id: 'off-2',
      courierId: 'courier-2',
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
      id: 'off-3',
      courierId: 'courier-3',
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

    // Verificación estricta: ninguna estrella ni mención a calificaciones (S4)
    expect(renderedText).not.toMatch(/★|☆|⭐/);
    expect(renderedText).not.toMatch(/4\.9/);
    expect(renderedText).not.toMatch(/182 viajes/i);
    expect(renderedText).not.toMatch(/reseñas?|reviews?|calificaciones?/i);

    // En cambio, las insignias de documentación verificada SÍ deben mostrarse
    expect(screen.getAllByText(/Licencia verificada/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Seguro verificado/i).length).toBeGreaterThan(0);
  });

  it('DoD: Ordenamiento por doc_level (por defecto) y por precio', () => {
    render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

    // Por defecto doc_level: Joaquín (docLevel 2), Micaela (docLevel 1), Carlos (docLevel 0)
    let cards = screen.getAllByRole('heading', { level: 4 });
    expect(cards[0]?.textContent).toContain('Joaquín R.');
    expect(cards[1]?.textContent).toContain('Micaela T.');
    expect(cards[2]?.textContent).toContain('Carlos P.');

    // Conmutar a "Precio"
    const priceButton = screen.getByRole('button', { name: /precio/i });
    fireEvent.click(priceButton);

    // Por precio ascendente: Micaela ($ 1.400), Joaquín ($ 1.800), Carlos ($ 2.000)
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
        acceptedOfferId: 'off-1',
        matchedAt: '2026-09-24T01:30:00Z',
        idempotent: false,
      },
    });

    render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

    // Click en aceptar la primera oferta (Joaquín R.)
    const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
    const firstAcceptButton = acceptButtons[0];
    expect(firstAcceptButton).toBeDefined();
    if (firstAcceptButton) {
      fireEvent.click(firstAcceptButton);
    }

    // Modal abierto con título C05
    expect(
      screen.getByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
    ).toBeDefined();

    // Desglose de tarifa acordada
    expect(screen.getAllByText(/\$ 1\.800/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Tarifa acordada/i)).toBeDefined();

    // Desglose de medio de pago y cambio
    expect(screen.getAllByText(/Efectivo/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/necesita cambio/i)).toBeDefined();

    // Texto de revelación progresiva D3
    expect(
      screen.getByText(
        /Al aceptar, Joaquín va a ver la dirección de retiro, la de entrega y los datos de tu cliente\. Las otras ofertas se rechazan\./i
      )
    ).toBeDefined();

    // Ausencia de estrellas dentro del modal
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).not.toMatch(/★|⭐|4\.9|viajes/i);

    // Confirmar en el modal
    const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockAcceptOfferAction).toHaveBeenCalledWith({ offerId: 'off-1' });
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
    // Componente monta y suscribe a Supabase Realtime real (PR76-H05)
    const { unmount } = render(
      <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
    );

    // Verificamos que la nueva oferta no está todavía
    expect(screen.queryByText('Lucas G.')).toBeNull();

    // Verificamos suscripción real de Supabase Realtime (channel postgres_changes con filter)
    expect(mockChannel.subscribe).toHaveBeenCalled();
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        table: 'offers',
        filter: `request_id=eq.${mockRequest.id}`,
      }),
      expect.any(Function)
    );

    // Se simula la llegada en vivo de una oferta vía canal Realtime
    const incomingOffer: MerchantOfferItem = {
      id: 'off-4',
      courierId: 'courier-4',
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

    expect(realtimeCallback).toBeTypeOf('function');
    await waitFor(() => {
      realtimeCallback!({
        eventType: 'INSERT',
        new: incomingOffer,
        old: null,
      });
    });

    // La oferta nueva aparece en el DOM sin recargar la página
    await waitFor(() => {
      expect(screen.getByText('Lucas G.')).toBeDefined();
      expect(screen.getByText('$ 1.600')).toBeDefined();
    });

    // Verificamos cleanup al desmontar (PR76-H05)
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });
});
