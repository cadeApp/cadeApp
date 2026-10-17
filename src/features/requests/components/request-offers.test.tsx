// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { RequestOffersList } from './request-offers-list';
import { requestsCopy } from '../copy';
import { requestKeys } from '../query-keys';
import type { MerchantOfferItem, MerchantRequestDetail } from '../types';
import type { RpcOutput } from '@/domain';

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
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  async function flushRealtimeSetup() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

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
      status: 'pending',
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
      status: 'pending',
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
      status: 'pending',
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

  it('T-363: sin distancia calculada muestra «Distancia no calculada» y nunca «· km» vacío', () => {
    const { container } = render(
      <RequestOffersList
        request={{ ...mockRequest, approxDistanceKm: null }}
        initialOffers={initialOffers}
      />
    );

    expect(screen.getByText('Distancia no calculada')).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/·\s*km/);
    expect(text).not.toMatch(/\bkm\b/);
  });

  it('T-363: con distancia calculada la muestra como aproximada en km', () => {
    render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);
    expect(screen.getByText('≈ 2,5 km')).toBeTruthy();
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

    await flushRealtimeSetup();

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

  describe('CC-023: el monto exacto de cambio del detalle sale de get_merchant_request_private_fields', () => {
    // Con CC-023 `queries.ts` arma `cashChangeAmount` y `notes` con la salida de la RPC (lo prueba
    // `queries.test.ts`); acá se fija que la vista los sigue mostrando igual que antes.
    const privateFields: RpcOutput<'get_merchant_request_private_fields'> = {
      requestId: '77777777-7777-4777-8777-777777777777',
      notes: 'Tocar timbre 2B',
      cashChangeAmount: 7300,
    };
    const detail = (fields: RpcOutput<'get_merchant_request_private_fields'>): MerchantRequestDetail => ({
      id: fields.requestId,
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Barrio Norte',
      approxDistanceKm: '2,5',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: true,
      cashChangeAmount: fields.cashChangeAmount,
      notes: fields.notes,
      status: 'published',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      createdAt: '2026-10-06T12:00:00.000Z',
      acceptedOfferId: null,
    });

    it('muestra «Paga con $ …» en el encabezado y en la confirmación de aceptación', () => {
      const { container } = render(
        <RequestOffersList request={detail(privateFields)} initialOffers={initialOffers} />
      );

      expect(container.textContent).toMatch(/\(Paga con \$\s?7\.300\)/);

      const firstAcceptButton = screen.getAllByRole('button', { name: /aceptar/i })[0];
      if (!firstAcceptButton) throw new Error('sin botón Aceptar');
      fireEvent.click(firstAcceptButton);

      expect(screen.getByRole('dialog').textContent).toMatch(/paga con \$\s?7\.300/);
    });

    it('sin monto de la RPC no inventa «Paga con»', () => {
      const { container } = render(
        <RequestOffersList
          request={detail({ ...privateFields, cashChangeAmount: null })}
          initialOffers={initialOffers}
        />
      );

      expect(container.textContent).not.toMatch(/paga con/i);
    });

    it('H06: solicitud multi-drop muestra ruta compuesta, badge de entregas y desglose por drop', () => {
      const multiDropDetail: MerchantRequestDetail = {
        id: '11111111-1111-1111-1111-111111111111',
        pickupZoneName: 'Centro Aguilares',
        dropoffZoneName: 'Barrio Norte',
        approxDistanceKm: '3,8',
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        cashChangeAmount: null,
        notes: null,
        status: 'published',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        createdAt: '2026-10-06T12:00:00.000Z',
        acceptedOfferId: null,
        dropsCount: 2,
        drops: [
          {
            id: 'drop-1',
            position: 1,
            dropoffZoneName: 'Barrio Norte',
            packageType: 'chico',
            recipientPaymentMethod: 'cash',
            needsChange: false,
          },
          {
            id: 'drop-2',
            position: 2,
            dropoffZoneName: 'Barrio Sur',
            packageType: 'mediano',
            recipientPaymentMethod: 'transfer',
            needsChange: false,
          },
        ],
      };

      const { container } = render(
        <RequestOffersList request={multiDropDetail} initialOffers={initialOffers} />
      );

      expect(container.textContent).toContain('Centro Aguilares');
      expect(container.textContent).toContain('Barrio Norte · Barrio Sur');
      expect(container.textContent).toContain('2 entregas');
      expect(screen.getByText('Entrega 1:')).toBeDefined();
      expect(screen.getByText('Entrega 2:')).toBeDefined();
      expect(container.textContent).toContain('Paquete Mediano');
      expect(container.textContent).toContain('Transferencia');
    });
  });

  describe('T-365: defensa de ofertas elegibles y estados terminales en RequestOffersList', () => {
    const nonPendingStatuses = [
      'accepted',
      'rejected',
      'withdrawn',
      'expired',
      'cancelled',
      undefined,
    ] as const;

    it.each(nonPendingStatuses)(
      'impide botón Aceptar, no abre modal y no invoca action para oferta con status %s',
      (status) => {
        const offerWithStatus: MerchantOfferItem = {
          ...initialOffers[0]!,
          status: status as MerchantOfferItem['status'],
        };

        render(<RequestOffersList request={mockRequest} initialOffers={[offerWithStatus]} />);

        expect(screen.queryByRole('button', { name: /aceptar/i })).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(mockAcceptOfferAction).not.toHaveBeenCalled();
      }
    );

    it('permite botón Aceptar y abre modal para oferta con status pending válido', () => {
      render(<RequestOffersList request={mockRequest} initialOffers={[initialOffers[0]!]} />);

      const acceptButton = screen.getByRole('button', { name: /aceptar/i });
      fireEvent.click(acceptButton);

      expect(
        screen.getByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
      ).toBeDefined();
    });

    it('impide botón Aceptar si request.status no es published (ej: matched)', () => {
      render(
        <RequestOffersList
          request={{ ...mockRequest, status: 'matched' }}
          initialOffers={initialOffers}
        />
      );

      const acceptButtons = screen.queryAllByRole('button', { name: /aceptar/i });
      expect(acceptButtons).toHaveLength(0);
    });

    it('PR390-H05: cierra modal y no invoca action si query actualiza a lista vacía manteniendo initialOffers inmutable', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      let fetchOffersData: MerchantOfferItem[] = [...initialOffers];
      vi.spyOn(global, 'fetch').mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: fetchOffersData,
          nextCursor: null,
        }),
      } as Response));

      render(
        <QueryClientProvider client={queryClient}>
          <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
        </QueryClientProvider>
      );

      await flushRealtimeSetup();

      const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
      fireEvent.click(acceptButtons[0]!);

      expect(
        screen.getByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
      ).toBeDefined();

      // Entregar por fetch/QueryClient la respuesta posterior { data: [], nextCursor: null }
      fetchOffersData = [];
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: requestKeys.offers(mockRequest.id) });
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
        ).toBeNull();
      });

      expect(mockAcceptOfferAction).not.toHaveBeenCalled();
    });

    it('PR390-H05: cierra modal y no invoca action si query actualiza la oferta a estado terminal manteniendo initialOffers inmutable', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      let fetchOffersData: MerchantOfferItem[] = [...initialOffers];
      vi.spyOn(global, 'fetch').mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: fetchOffersData,
          nextCursor: null,
        }),
      } as Response));

      render(
        <QueryClientProvider client={queryClient}>
          <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
        </QueryClientProvider>
      );

      await flushRealtimeSetup();

      const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
      fireEvent.click(acceptButtons[0]!);

      expect(
        screen.getByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
      ).toBeDefined();

      // Actualizar a estado terminal permitido por el contrato de live (withdrawn)
      fetchOffersData = [
        {
          ...initialOffers[0]!,
          status: 'withdrawn',
        },
      ];
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: requestKeys.offers(mockRequest.id) });
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
        ).toBeNull();
      });

      expect(mockAcceptOfferAction).not.toHaveBeenCalled();
    });

    it('cierra modal y bloquea confirmación si request deja de ser published', async () => {
      const { rerender } = render(
        <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
      );

      const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
      fireEvent.click(acceptButtons[0]!);

      expect(
        screen.getByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
      ).toBeDefined();

      rerender(
        <RequestOffersList
          request={{ ...mockRequest, status: 'matched' }}
          initialOffers={initialOffers}
        />
      );

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
        ).toBeNull();
      });

      expect(mockAcceptOfferAction).not.toHaveBeenCalled();
    });

    it('online -> offline -> reconnect con respuesta tardía: no permite aceptar instantáneas offline y cierra modal', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      vi.spyOn(global, 'fetch').mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: [...initialOffers],
          nextCursor: null,
        }),
      } as Response));

      render(
        <QueryClientProvider client={queryClient}>
          <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
        </QueryClientProvider>
      );

      await flushRealtimeSetup();

      // Abrir modal online
      const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
      fireEvent.click(acceptButtons[0]!);
      expect(
        screen.getByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
      ).toBeDefined();

      // Transición a offline: UI debe cerrar modal e impedir aceptación de instantáneas offline
      act(() => {
        onlineManager.setOnline(false);
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
        ).toBeNull();
      });
      expect(screen.queryAllByRole('button', { name: /aceptar/i })).toHaveLength(0);
      expect(mockAcceptOfferAction).not.toHaveBeenCalled();

      // Configurar respuesta tardía para reconnect
      let resolveLateFetch: ((value: Response) => void) | null = null;
      const lateFetchPromise = new Promise<Response>((resolve) => {
        resolveLateFetch = resolve;
      });
      vi.spyOn(global, 'fetch').mockImplementation(() => lateFetchPromise);

      // Transición a reconnect: onlineManager -> true
      act(() => {
        onlineManager.setOnline(true);
      });

      // La respuesta tardía finalmente llega con la oferta retirada
      await act(async () => {
        if (resolveLateFetch) {
          resolveLateFetch({
            ok: true,
            status: 200,
            json: async () => ({
              data: [],
              nextCursor: null,
            }),
          } as Response);
        }
        await lateFetchPromise;
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
        ).toBeNull();
      });
      expect(mockAcceptOfferAction).not.toHaveBeenCalled();
    });

    it('handleConfirmAccept valida membresía en offers y no llama a acceptOfferAction si la oferta desapareció', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      let fetchOffersData: MerchantOfferItem[] = [...initialOffers];
      vi.spyOn(global, 'fetch').mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: fetchOffersData,
          nextCursor: null,
        }),
      } as Response));

      render(
        <QueryClientProvider client={queryClient}>
          <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
        </QueryClientProvider>
      );

      await flushRealtimeSetup();

      const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
      fireEvent.click(acceptButtons[0]!);

      expect(
        screen.getByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
      ).toBeDefined();

      // Desaparece la oferta de la query
      fetchOffersData = [];
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: requestKeys.offers(mockRequest.id) });
      });

      // El modal se cierra inmediatamente porque la oferta ya no existe en offers
      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /¿Aceptás la oferta de Joaquín R.\?/i })
        ).toBeNull();
      });

      expect(mockAcceptOfferAction).not.toHaveBeenCalled();
    });

    it('tras OFFER_NOT_PENDING invoca refetch/fetch, la respuesta actualizada elimina la oferta y el error se anuncia al usuario', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });

      mockAcceptOfferAction.mockResolvedValueOnce({
        ok: false,
        code: 'OFFER_NOT_PENDING',
      });

      // Inicialmente devuelve initialOffers; tras refetch traerá la lista sin la oferta obsoleta (Joaquín R.)
      let fetchCount = 0;
      const remainingOffers = [initialOffers[1]!, initialOffers[2]!];
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        fetchCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: fetchCount === 1 ? initialOffers : remainingOffers,
            nextCursor: null,
          }),
        } as Response;
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
        </QueryClientProvider>
      );

      await flushRealtimeSetup();

      const acceptButtons = screen.getAllByRole('button', { name: /aceptar/i });
      fireEvent.click(acceptButtons[0]!);

      const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // 1. mockAcceptOfferAction fue invocado
      expect(mockAcceptOfferAction).toHaveBeenCalledWith({
        offerId: initialOffers[0]!.id,
      });

      // 2. refetch() invoca fetch
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      // 3. La respuesta actualizada elimina la oferta obsoleta del DOM
      await waitFor(() => {
        expect(screen.queryByText('Joaquín R.')).toBeNull();
      });

      // 4. El modal se cierra
      expect(screen.queryByRole('dialog')).toBeNull();

      // 5. El error se anuncia al usuario de forma accesible (role="alert")
      const alerts = screen.getAllByRole('alert');
      const errorAlert = alerts.find((a) =>
        a.textContent?.includes('Esta oferta ya no está disponible.')
      );
      expect(errorAlert).toBeDefined();
    });
  });
});


