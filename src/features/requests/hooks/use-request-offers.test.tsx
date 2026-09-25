import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRequestOffers } from './use-request-offers';
import { requestKeys } from '../query-keys';
import * as browserClient from '@/lib/supabase/browser';
import type { MerchantOfferItem } from '../types';

describe('T-204 DoD: useRequestOffers con TanStack Query y Realtime', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let realtimeCallback: ((payload: unknown) => void) | null = null;

  const initialOffers: MerchantOfferItem[] = [
    {
      id: 'offer-initial-1',
      courierId: 'courier-1',
      courierName: 'Carlos Gómez',
      vehicleType: 'motorcycle',
      amountArs: 1500,
      etaMinutes: 15,
      message: null,
      licenseStatus: 'verified',
      insuranceStatus: 'verified',
      docLevel: 2,
      createdAt: new Date().toISOString(),
      status: 'pending',
    },
  ];

  beforeEach(() => {
    // PR82-H06: Emular providers.tsx con staleTime: 60s
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    });

    realtimeCallback = null;
    mockRemoveChannel = vi.fn();
    mockSubscribe = vi.fn().mockReturnThis();
    mockOn = vi.fn().mockImplementation((_event, _filter, callback) => {
      realtimeCallback = callback;
      return mockChannel;
    });

    mockChannel = {
      on: mockOn,
      subscribe: mockSubscribe,
    };

    vi.spyOn(browserClient, 'createClient').mockReturnValue({
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: mockRemoveChannel,
    } as unknown as ReturnType<typeof browserClient.createClient>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('DoD: Con el push apagado, la oferta nueva aparece al volver a la app (refetchOnWindowFocus: always)', async () => {
    const updatedOffers: MerchantOfferItem[] = [
      ...initialOffers,
      {
        id: 'offer-new-2',
        courierId: 'courier-2',
        courierName: 'María López',
        vehicleType: 'bicycle',
        amountArs: 1200,
        etaMinutes: 20,
        message: 'Llego rápido',
        licenseStatus: 'none',
        insuranceStatus: 'none',
        docLevel: 0,
        createdAt: new Date().toISOString(),
        status: 'pending',
      },
    ];

    const fetchOffersMock = vi.fn().mockResolvedValue(updatedOffers);

    const { result } = renderHook(
      () =>
        useRequestOffers('req-123', initialOffers, {
          fetcher: fetchOffersMock,
        }),
      { wrapper }
    );

    expect(result.current.offers).toHaveLength(1);
    expect(result.current.offers[0]?.id).toBe('offer-initial-1');

    // Simular que el usuario vuelve a la app (evento window focus) sin push
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.offers).toHaveLength(2);
    });

    expect(result.current.offers.some((o: MerchantOfferItem) => o.id === 'offer-new-2')).toBe(true);
    expect(fetchOffersMock).toHaveBeenCalledTimes(1);
  });

  it('DoD: reconexión de red (online) refetchea ofertas en vivo (refetchOnReconnect: always)', async () => {
    const updatedOffers: MerchantOfferItem[] = [
      ...initialOffers,
      {
        id: 'offer-reconnect',
        courierId: 'courier-3',
        courierName: 'Pedro Acosta',
        vehicleType: 'auto',
        amountArs: 1800,
        etaMinutes: 10,
        message: null,
        licenseStatus: 'verified',
        insuranceStatus: 'none',
        docLevel: 1,
        createdAt: new Date().toISOString(),
        status: 'pending',
      },
    ];

    const fetchOffersMock = vi.fn().mockResolvedValue(updatedOffers);

    const { result } = renderHook(
      () =>
        useRequestOffers('req-123', initialOffers, {
          fetcher: fetchOffersMock,
        }),
      { wrapper }
    );

    expect(result.current.offers).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current.offers).toHaveLength(2);
    });
    expect(fetchOffersMock).toHaveBeenCalledTimes(1);
  });

  it('DoD: al desmontar la pantalla se cierra el canal', () => {
    const { unmount } = renderHook(
      () => useRequestOffers('req-123', initialOffers),
      { wrapper }
    );

    expect(mockSubscribe).toHaveBeenCalled();
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it('DoD: Realtime no escribe la caché a mano, solo invalida queries tras debounce (PR82-H04)', async () => {
    vi.useFakeTimers();
    try {
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useRequestOffers('req-123', initialOffers),
        { wrapper }
      );

      // Si llega un evento de Realtime con nueva oferta
      act(() => {
        if (realtimeCallback) {
          realtimeCallback({
            eventType: 'INSERT',
            new: { id: 'offer-3', amount_ars: 1700 },
          });
        }
      });

      // Invariantes inmediatas tras el evento Realtime:
      // 1. La caché NO se muta a mano con setQueryData
      expect(setQueryDataSpy).not.toHaveBeenCalled();
      // 2. El estado devuelto NO inyecta el payload crudo de Realtime
      expect(result.current.offers).toHaveLength(1);
      // 3. Aún no se invalida porque está dentro de la ventana de debounce (300ms)
      expect(invalidateSpy).not.toHaveBeenCalled();

      // Avanzar reloj para superar el debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Tras el debounce, se invalida exactamente con la query key canónica
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: requestKeys.offers('req-123'),
      });
      // Sigue sin mutar manualmente la caché
      expect(setQueryDataSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('PR82-H13: onOfferAdded y onOfferUpdated se ejecutan en useEffect posterior al render (no durante el render)', async () => {
    const executionPhases: string[] = [];
    const addedOffers: MerchantOfferItem[] = [];

    const newOffer: MerchantOfferItem = {
      id: 'offer-effect-test',
      courierId: 'courier-99',
      courierName: 'Laura T.',
      vehicleType: 'bicycle',
      amountArs: 1400,
      etaMinutes: 12,
      message: null,
      licenseStatus: 'none',
      insuranceStatus: 'none',
      docLevel: 0,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    let fetchResults = [...initialOffers];

    const { result } = renderHook(
      () => {
        executionPhases.push('start-render');
        const res = useRequestOffers('req-123', initialOffers, {
          fetcher: async () => fetchResults,
          onOfferAdded: (offer) => {
            executionPhases.push('callback');
            addedOffers.push(offer);
          },
        });
        executionPhases.push('end-render');
        return res;
      },
      { wrapper }
    );

    // Monte inicial: no dispara onOfferAdded
    expect(addedOffers).toHaveLength(0);
    executionPhases.length = 0; // Limpiar para el update

    // Simular llegada de nueva oferta mediante refetch de TanStack Query
    fetchResults = [...initialOffers, newOffer];
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.offers).toHaveLength(2);
    });

    // En useEffect, 'callback' DEBE ejecutarse estrictamente después de 'end-render'.
    // Si se ejecutara en el cuerpo del hook (durante render), 'callback' aparecería antes de 'end-render'.
    expect(executionPhases).toEqual(['start-render', 'end-render', 'callback']);
    expect(addedOffers).toHaveLength(1);
    expect(addedOffers[0]?.id).toBe('offer-effect-test');
  });
});

