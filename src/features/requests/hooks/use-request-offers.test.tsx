import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRequestOffers } from './use-request-offers';
import * as browserClient from '@/lib/supabase/browser';
import type { MerchantOfferItem } from '../types';

describe('T-204 DoD: useRequestOffers con TanStack Query y Realtime', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
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
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
        },
      },
    });

    realtimeCallback = null;
    mockRemoveChannel = vi.fn();
    mockSubscribe = vi.fn().mockReturnThis();
    mockOn = vi.fn().mockImplementation((_event, _filter, callback) => {
      realtimeCallback = callback;
      return { subscribe: mockSubscribe };
    });

    vi.spyOn(browserClient, 'createClient').mockReturnValue({
      channel: vi.fn().mockReturnValue({
        on: mockOn,
        subscribe: mockSubscribe,
      }),
      removeChannel: mockRemoveChannel,
    } as unknown as ReturnType<typeof browserClient.createClient>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('DoD: Con el push apagado, la oferta nueva aparece al volver a la app (refetchOnWindowFocus)', async () => {
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

    const fetchOffersMock = vi
      .fn()
      .mockResolvedValueOnce(initialOffers)
      .mockResolvedValueOnce(updatedOffers);

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

    expect(result.current.offers.some((o) => o.id === 'offer-new-2')).toBe(true);
    expect(fetchOffersMock).toHaveBeenCalledTimes(2);
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

  it('DoD: Realtime no escribe la caché a mano, solo invalida queries', async () => {
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(
      () => useRequestOffers('req-123', initialOffers),
      { wrapper }
    );

    // Si llega un evento de Realtime
    act(() => {
      if (realtimeCallback) {
        realtimeCallback({
          eventType: 'INSERT',
          new: { id: 'offer-3', amount_ars: 1700 },
        });
      }
    });

    // Invariante dura: Realtime no escribe a mano la caché
    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });
});
