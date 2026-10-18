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

const { mockPush, mockReplace, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}));

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

    describe('PR390-H13: sincronización post-reconexión y control de elegibilidad en UI', () => {
      it('(1) offline: no CTA, no action', async () => {
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });

        render(
          <QueryClientProvider client={queryClient}>
            <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
          </QueryClientProvider>
        );

        await flushRealtimeSetup();

        // En offline no hay CTA disponible
        act(() => {
          onlineManager.setOnline(false);
        });

        await waitFor(() => {
          expect(screen.queryAllByRole('button', { name: /^aceptar$/i })).toHaveLength(0);
        });
        expect(mockAcceptOfferAction).not.toHaveBeenCalled();
      });

      it('(2) inmediatamente al volver online y ANTES de resolver fetch: sigue sin CTA, no action', async () => {
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });

        let resolveDeferred: ((res: Response) => void) | null = null;
        const deferredPromise = new Promise<Response>((resolve) => {
          resolveDeferred = resolve;
        });

        render(
          <QueryClientProvider client={queryClient}>
            <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
          </QueryClientProvider>
        );

        await flushRealtimeSetup();

        act(() => {
          onlineManager.setOnline(false);
        });

        // Configurar fetch diferido para reconexión
        vi.spyOn(global, 'fetch').mockImplementation(() => deferredPromise);

        // Volver online: onlineManager es true, pero el fetch aún no resolvió
        act(() => {
          onlineManager.setOnline(true);
        });

        // Inmediatamente tras volver online y ANTES de resolver fetch:
        expect(screen.queryAllByRole('button', { name: /^aceptar$/i })).toHaveLength(0);
        expect(mockAcceptOfferAction).not.toHaveBeenCalled();

        // Limpiar promesa diferida
        await act(async () => {
          if (resolveDeferred) {
            resolveDeferred({
              ok: true,
              status: 200,
              json: async () => ({ data: [], nextCursor: null }),
            } as Response);
          }
          await deferredPromise;
        });
      });

      it('(3) post resultado data:[]: sigue ausente el CTA', async () => {
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });

        let resolveDeferred: ((res: Response) => void) | null = null;
        const deferredPromise = new Promise<Response>((resolve) => {
          resolveDeferred = resolve;
        });
        vi.spyOn(global, 'fetch').mockImplementation(() => deferredPromise);

        render(
          <QueryClientProvider client={queryClient}>
            <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
          </QueryClientProvider>
        );

        await flushRealtimeSetup();

        act(() => {
          onlineManager.setOnline(false);
        });

        act(() => {
          onlineManager.setOnline(true);
        });

        // Resolver con data vacía (todas las ofertas fueron canceladas)
        await act(async () => {
          if (resolveDeferred) {
            resolveDeferred({
              ok: true,
              status: 200,
              json: async () => ({ data: [], nextCursor: null }),
            } as Response);
          }
          await deferredPromise;
        });

        await waitFor(() => {
          expect(screen.queryAllByRole('button', { name: /^aceptar$/i })).toHaveLength(0);
        });
        expect(mockAcceptOfferAction).not.toHaveBeenCalled();
      });

      it('(4) post resultado con oferta pending nueva: recién entonces reaparece CTA', async () => {
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });

        let resolveDeferred: ((res: Response) => void) | null = null;
        const deferredPromise = new Promise<Response>((resolve) => {
          resolveDeferred = resolve;
        });
        vi.spyOn(global, 'fetch').mockImplementation(() => deferredPromise);

        render(
          <QueryClientProvider client={queryClient}>
            <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
          </QueryClientProvider>
        );

        await flushRealtimeSetup();

        act(() => {
          onlineManager.setOnline(false);
        });

        act(() => {
          onlineManager.setOnline(true);
        });

        expect(screen.queryAllByRole('button', { name: /^aceptar$/i })).toHaveLength(0);

        const newPendingOffer: MerchantOfferItem = {
          ...initialOffers[0]!,
          id: '55555555-5555-4555-8555-555555555555',
          courierName: 'Nuevo Cadete',
          status: 'pending',
        };

        await act(async () => {
          if (resolveDeferred) {
            resolveDeferred({
              ok: true,
              status: 200,
              json: async () => ({ data: [newPendingOffer], nextCursor: null }),
            } as Response);
          }
          await deferredPromise;
        });

        await waitFor(() => {
          expect(screen.getAllByRole('button', { name: /^aceptar$/i })).toHaveLength(1);
          expect(screen.getByText('Nuevo Cadete')).toBeDefined();
        });
      });

      it('(5) fetch HTTP 500 / parse inválido mantiene bloqueo, permite reintento real', async () => {
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });

        render(
          <QueryClientProvider client={queryClient}>
            <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
          </QueryClientProvider>
        );

        await flushRealtimeSetup();

        act(() => {
          onlineManager.setOnline(false);
        });

        // Mock fetch que falla con 500
        let fetchCallCount = 0;
        vi.spyOn(global, 'fetch').mockImplementation(async () => {
          fetchCallCount++;
          if (fetchCallCount === 1) {
            return {
              ok: false,
              status: 500,
            } as Response;
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [...initialOffers], nextCursor: null }),
          } as Response;
        });

        act(() => {
          onlineManager.setOnline(true);
        });

        // Debe mantener bloqueo
        await waitFor(() => {
          expect(screen.queryAllByRole('button', { name: /^aceptar$/i })).toHaveLength(0);
        });

        // Error visible y botón de reintento presente
        const retryBtn = await screen.findByRole('button', { name: /reintentar/i });
        expect(retryBtn).toBeDefined();

        // Ejecutar reintento real
        await act(async () => {
          fireEvent.click(retryBtn);
        });

        // Tras reintento exitoso, el CTA reaparece
        await waitFor(() => {
          expect(screen.getAllByRole('button', { name: /^aceptar$/i })).toHaveLength(
            initialOffers.length
          );
        });
      });

      it('(6) dos ciclos y fetch iniciado antes del corte que termina tarde, sin desbloquear', async () => {
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });

        let resolveOldFetch: ((res: Response) => void) | null = null;
        const oldFetchPromise = new Promise<Response>((resolve) => {
          resolveOldFetch = resolve;
        });

        vi.spyOn(global, 'fetch').mockImplementationOnce(() => oldFetchPromise);

        render(
          <QueryClientProvider client={queryClient}>
            <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
          </QueryClientProvider>
        );

        await flushRealtimeSetup();

        // Ciclo 1: corte offline
        act(() => {
          onlineManager.setOnline(false);
        });

        // Ciclo 2: reconexión con fetch 2 diferido
        let resolveNewFetch: ((res: Response) => void) | null = null;
        const newFetchPromise = new Promise<Response>((resolve) => {
          resolveNewFetch = resolve;
        });
        vi.spyOn(global, 'fetch').mockImplementation(() => newFetchPromise);

        act(() => {
          onlineManager.setOnline(true);
        });

        // Fetch viejo (iniciado antes del corte) resuelve ahora con ofertas viejas pending
        await act(async () => {
          if (resolveOldFetch) {
            resolveOldFetch({
              ok: true,
              status: 200,
              json: async () => ({ data: [...initialOffers], nextCursor: null }),
            } as Response);
          }
          await oldFetchPromise;
        });

        // El fetch viejo NO debe desbloquear CTA
        expect(screen.queryAllByRole('button', { name: /^aceptar$/i })).toHaveLength(0);
        expect(mockAcceptOfferAction).not.toHaveBeenCalled();

        // El fetch nuevo resuelve
        await act(async () => {
          if (resolveNewFetch) {
            resolveNewFetch({
              ok: true,
              status: 200,
              json: async () => ({ data: [...initialOffers], nextCursor: null }),
            } as Response);
          }
          await newFetchPromise;
        });

        // Ahora sí reaparece CTA
        await waitFor(() => {
          expect(screen.getAllByRole('button', { name: /^aceptar$/i })).toHaveLength(
            initialOffers.length
          );
        });
      });

      it('(7) T-333 reconexión y limpieza de listener intactas', () => {
        const subscribeSpy = vi.spyOn(onlineManager, 'subscribe');
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });

        const { unmount } = render(
          <QueryClientProvider client={queryClient}>
            <RequestOffersList request={mockRequest} initialOffers={initialOffers} />
          </QueryClientProvider>
        );

        expect(subscribeSpy).toHaveBeenCalled();
        unmount();
      });
    });

    describe('PR390-H16: protección de reconexión multipágina en UI (2+ páginas)', () => {
      it('con 2 páginas cargadas, durante el refetch post-reconexión mientras página 2 está en vuelo, los botones Aceptar están bloqueados', async () => {
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });

        const offerPage1 = initialOffers[0];
        if (!offerPage1) throw new Error('Falta offerPage1');
        const cursor1 = {
          createdAt: offerPage1.createdAt,
          id: offerPage1.id,
        };
        const secondInitial = initialOffers[1];
        if (!secondInitial) throw new Error('Falta secondInitial');
        const offerX: MerchantOfferItem = {
          ...secondInitial,
          id: '99999999-9999-4999-8999-999999999999',
          courierName: 'Cadete Que Cancelo',
          status: 'pending',
        };

        let resolvePage2: ((res: Response) => void) | null = null;
        const page2Promise = new Promise<Response>((resolve) => {
          resolvePage2 = resolve;
        });

        // 1. Montaje con página 1 y cursor para página 2
        vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
          const urlStr =
            typeof input === 'string'
              ? input
              : input instanceof URL
              ? input.toString()
              : '';
          if (urlStr.includes('cursorCreatedAt')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                data: [offerX],
                nextCursor: null,
              }),
            } as Response;
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [offerPage1],
              nextCursor: cursor1,
            }),
          } as Response;
        });

        render(
          <QueryClientProvider client={queryClient}>
            <RequestOffersList
              request={mockRequest}
              initialOffers={[offerPage1]}
              initialNextCursor={cursor1}
            />
          </QueryClientProvider>
        );

        await flushRealtimeSetup();

        // Cargar página 2
        const loadMoreButton = screen.queryByRole('button', { name: /cargar más/i });
        if (loadMoreButton) {
          fireEvent.click(loadMoreButton);
          await waitFor(() => {
            expect(screen.getByText('Cadete Que Cancelo')).toBeDefined();
          });
        }

        // Antes del corte: hay botones Aceptar disponibles
        expect(screen.getAllByRole('button', { name: /^aceptar$/i }).length).toBeGreaterThan(0);

        // 2. Corte de red (offline)
        act(() => {
          onlineManager.setOnline(false);
        });

        // Inmediatamente sin botones Aceptar
        expect(screen.queryAllByRole('button', { name: /^aceptar$/i })).toHaveLength(0);

        // 3. Configurar refetch post-reconexión:
        // Página 1 resuelve rápido con offerPage1
        // Página 2 diferida
        vi.spyOn(global, 'fetch').mockImplementation((input) => {
          const urlStr =
            typeof input === 'string'
              ? input
              : input instanceof URL
              ? input.toString()
              : '';
          if (urlStr.includes('cursorCreatedAt')) {
            return page2Promise;
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              data: [offerPage1],
              nextCursor: cursor1,
            }),
          } as Response);
        });

        // 4. Reconexión
        act(() => {
          onlineManager.setOnline(true);
        });

        // Inmediatamente tras volver online y mientras página 2 está en vuelo:
        // PR390-H16: los botones Aceptar DEBEN permanecer bloqueados
        expect(screen.queryAllByRole('button', { name: /^aceptar$/i })).toHaveLength(0);
        expect(mockAcceptOfferAction).not.toHaveBeenCalled();

        // 5. Resolver página 2 sin la oferta cancelada
        await act(async () => {
          if (resolvePage2) {
            resolvePage2({
              ok: true,
              status: 200,
              json: async () => ({ data: [], nextCursor: null }),
            } as Response);
          }
          await page2Promise;
        });

        // Ahora que la consulta completa asentó: reaparece CTA solo para oferta válida
        await waitFor(() => {
          expect(screen.getAllByRole('button', { name: /^aceptar$/i })).toHaveLength(1);
        });
        expect(screen.queryByText('Cadete Que Cancelo')).toBeNull();
      });
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

  describe('T-359: Redirección y estado post-aceptación', () => {
    it('DoD 1 / H04: al aceptar una oferta con éxito, navega a /trips/[id] con router.replace', async () => {
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
      fireEvent.click(acceptButtons[0]!);

      const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(`/trips/${mockRequest.id}`);
      });
    });

    it('H02: carrera concurrente con ALREADY_MATCHED bloquea inmediatamente todos los botones Aceptar e impide nuevas acciones de match', async () => {
      mockAcceptOfferAction.mockResolvedValue({
        ok: false,
        code: 'ALREADY_MATCHED',
        message: 'La solicitud ya fue asignada',
      });

      render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

      const acceptButtons = screen.getAllByRole('button', { name: /^aceptar$/i });
      expect(acceptButtons.length).toBeGreaterThan(0);
      fireEvent.click(acceptButtons[0]!);

      const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockAcceptOfferAction).toHaveBeenCalledTimes(1);
        expect(mockRefresh).toHaveBeenCalled();
      });

      // Modal cerrado tras reconciliación
      expect(screen.queryByRole('button', { name: /sí, aceptar/i })).toBeNull();

      // Bloqueo inmediato: ningún botón Aceptar debe estar visible en la vista mientras se reconcilia
      const remainingAcceptButtons = screen.queryAllByRole('button', { name: /^aceptar$/i });
      expect(remainingAcceptButtons).toHaveLength(0);
      expect(mockAcceptOfferAction).toHaveBeenCalledTimes(1);
    });

    it('H02: carrera con REQUEST_EXPIRED bloquea inmediatamente todos los botones Aceptar e impide nuevas acciones de match', async () => {
      mockAcceptOfferAction.mockResolvedValue({
        ok: false,
        code: 'REQUEST_EXPIRED',
        message: 'La solicitud ha expirado',
      });

      render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

      const acceptButtons = screen.getAllByRole('button', { name: /^aceptar$/i });
      expect(acceptButtons.length).toBeGreaterThan(0);
      fireEvent.click(acceptButtons[0]!);

      const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockAcceptOfferAction).toHaveBeenCalledTimes(1);
        expect(mockRefresh).toHaveBeenCalled();
      });

      // Modal cerrado
      expect(screen.queryByRole('button', { name: /sí, aceptar/i })).toBeNull();

      // Bloqueo inmediato
      const remainingAcceptButtons = screen.queryAllByRole('button', { name: /^aceptar$/i });
      expect(remainingAcceptButtons).toHaveLength(0);
      expect(mockAcceptOfferAction).toHaveBeenCalledTimes(1);
    });

    it('H02: error transitorio permite reintento y no activa latch de reconciliación permanente', async () => {
      mockAcceptOfferAction.mockResolvedValueOnce({
        ok: false,
        code: 'UNKNOWN_ERROR',
        message: 'Fallo de conexión',
      });

      render(<RequestOffersList request={mockRequest} initialOffers={initialOffers} />);

      const acceptButtons = screen.getAllByRole('button', { name: /^aceptar$/i });
      fireEvent.click(acceptButtons[0]!);

      const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockAcceptOfferAction).toHaveBeenCalledTimes(1);
      });

      // El modal permanece abierto con mensaje de error para permitir reintentar
      expect(screen.getByRole('button', { name: /sí, aceptar/i })).toBeDefined();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('H03: no muestra botón Aceptar si expiresAt ya venció en la solicitud', () => {
      const expiredRequest = {
        ...mockRequest,
        expiresAt: new Date(Date.now() - 60000).toISOString(),
      };

      render(<RequestOffersList request={expiredRequest} initialOffers={initialOffers} />);

      const acceptButtons = screen.queryAllByRole('button', { name: /^aceptar$/i });
      expect(acceptButtons).toHaveLength(0);
      expect(screen.getByText('Expirada')).toBeDefined();
    });

    it('H03: deshabilita aceptación al transicionar a vencida mediante reloj y bloquea confirmación abierta', async () => {
      vi.useFakeTimers();
      const nearFutureExpiresAt = new Date(Date.now() + 5000).toISOString();
      const expiringRequest = {
        ...mockRequest,
        expiresAt: nearFutureExpiresAt,
      };

      render(<RequestOffersList request={expiringRequest} initialOffers={initialOffers} />);

      // Inicialmente vigente
      const acceptButtons = screen.getAllByRole('button', { name: /^aceptar$/i });
      expect(acceptButtons.length).toBeGreaterThan(0);
      fireEvent.click(acceptButtons[0]!);

      expect(screen.getByRole('button', { name: /sí, aceptar/i })).toBeDefined();

      // Avanzamos el tiempo para que expire
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Intentar confirmar con la solicitud ya vencida
      const confirmButton = screen.getByRole('button', { name: /sí, aceptar/i });
      fireEvent.click(confirmButton);

      expect(mockAcceptOfferAction).not.toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('H03: no ofrece botón Aceptar sobre ofertas con status withdrawn o rejected', () => {
      const mixedOffers: MerchantOfferItem[] = [
        {
          ...initialOffers[0]!,
          id: 'offer-withdrawn',
          status: 'withdrawn',
        },
        {
          ...initialOffers[1]!,
          id: 'offer-rej',
          status: 'rejected',
        },
      ];

      render(<RequestOffersList request={mockRequest} initialOffers={mixedOffers} />);

      const acceptButtons = screen.queryAllByRole('button', { name: /^aceptar$/i });
      expect(acceptButtons).toHaveLength(0);
      expect(screen.getByText('Retirada')).toBeDefined();
      expect(screen.getByText('Rechazada')).toBeDefined();
    });

    it('H03: no ofrece botón Aceptar si request.status es draft, matched, cancelled o expired', () => {
      const statuses = ['draft', 'matched', 'cancelled', 'expired'] as const;

      for (const st of statuses) {
        const req = {
          ...mockRequest,
          status: st,
        };

        const { unmount } = render(
          <RequestOffersList request={req} initialOffers={initialOffers} />
        );

        const acceptButtons = screen.queryAllByRole('button', { name: /^aceptar$/i });
        expect(acceptButtons).toHaveLength(0);
        unmount();
      }
    });

    it('DoD 2: si la solicitud ya está en estado matched, ofrece enlace al viaje', () => {
      const matchedRequest = {
        ...mockRequest,
        status: 'matched' as const,
        acceptedOfferId: '11111111-1111-1111-1111-111111111111',
      };

      render(<RequestOffersList request={matchedRequest} initialOffers={initialOffers} />);

      const acceptButtons = screen.queryAllByRole('button', { name: /^aceptar$/i });
      expect(acceptButtons).toHaveLength(0);

      const tripLinks = screen.getAllByRole('link', { name: /ver viaje|ver detalle/i });
      expect(tripLinks.length).toBeGreaterThanOrEqual(1);
      expect(tripLinks[0]?.getAttribute('href')).toBe(`/trips/${mockRequest.id}`);
    });

    it('DoD 3: muestra badge Oferta aceptada para la oferta aceptada', () => {
      const mixedOffers: MerchantOfferItem[] = [
        {
          ...initialOffers[0]!,
          id: 'offer-acc',
          status: 'accepted',
        },
        {
          ...initialOffers[1]!,
          id: 'offer-pend',
          status: 'pending',
        },
      ];

      render(<RequestOffersList request={mockRequest} initialOffers={mixedOffers} />);

      const acceptButtons = screen.getAllByRole('button', { name: /^aceptar$/i });
      expect(acceptButtons).toHaveLength(1);
      expect(screen.getByText('Oferta aceptada')).toBeDefined();
    });
  });
});

