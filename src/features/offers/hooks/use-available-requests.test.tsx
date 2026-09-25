import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAvailableRequests } from './use-available-requests';
import { offerKeys } from '../query-keys';
import * as browserClient from '@/lib/supabase/browser';
import type { AvailableRequestItem } from '../schemas';

describe('T-204 DoD: useAvailableRequests (Courier Feed TanStack Query & Realtime)', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let realtimeCallback: ((payload: unknown) => void) | null = null;

  const initialRequests: AvailableRequestItem[] = [
    {
      id: 'req-1',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Barrio Norte',
      approxDistanceKm: '2,0',
      packageType: 'small',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      cashChangeAmount: null,
      notes: null,
      publishedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      hasMyOffer: false,
      myOfferAmountArs: null,
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

  it('DoD: Con push apagado, nuevas solicitudes aparecen al volver a la app (focus)', async () => {
    const updatedRequests: AvailableRequestItem[] = [
      ...initialRequests,
      {
        id: 'req-2',
        pickupZoneName: 'Plaza',
        dropoffZoneName: 'Sur',
        approxDistanceKm: '3,0',
        packageType: 'medium',
        recipientPaymentMethod: 'transfer',
        needsChange: false,
        cashChangeAmount: null,
        notes: null,
        publishedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        hasMyOffer: false,
        myOfferAmountArs: null,
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue(updatedRequests);

    const { result } = renderHook(
      () =>
        useAvailableRequests(initialRequests, {
          fetcher: fetchMock,
        }),
      { wrapper }
    );

    expect(result.current.requests).toHaveLength(1);

    // Simular que el repartidor vuelve a la app (focus)
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.requests).toHaveLength(2);
    });

    expect(result.current.requests.some((r: AvailableRequestItem) => r.id === 'req-2')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('DoD: reconexión de red (online) refetchea feed en vivo', async () => {
    const updatedRequests: AvailableRequestItem[] = [
      ...initialRequests,
      {
        id: 'req-online-3',
        pickupZoneName: 'Estación',
        dropoffZoneName: 'Centro',
        approxDistanceKm: '1,5',
        packageType: 'small',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        cashChangeAmount: null,
        notes: null,
        publishedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        hasMyOffer: false,
        myOfferAmountArs: null,
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue(updatedRequests);

    const { result } = renderHook(
      () =>
        useAvailableRequests(initialRequests, {
          fetcher: fetchMock,
        }),
      { wrapper }
    );

    expect(result.current.requests).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current.requests).toHaveLength(2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('DoD: al desmontar la pantalla se cierra el canal', () => {
    const { unmount } = renderHook(
      () => useAvailableRequests(initialRequests),
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
        () => useAvailableRequests(initialRequests),
        { wrapper }
      );

      // Simular evento Realtime
      act(() => {
        if (realtimeCallback) {
          realtimeCallback({
            eventType: 'INSERT',
            new: { id: 'req-new', status: 'published' },
          });
        }
      });

      // No muta la caché a mano ni inyecta en el estado
      expect(setQueryDataSpy).not.toHaveBeenCalled();
      expect(result.current.requests).toHaveLength(1);
      expect(invalidateSpy).not.toHaveBeenCalled();

      // Superar debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: offerKeys.availableRequests(undefined),
      });
      expect(setQueryDataSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
