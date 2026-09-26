import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTrip } from './use-trip';
import { tripKeys } from '../query-keys';
import * as browserClient from '@/lib/supabase/browser';

describe('T-204 DoD: useTrip (Active Trip TanStack Query & Realtime)', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let realtimeCallback: ((payload: unknown) => void) | null = null;

  const initialTrip = {
    id: 'trip-1',
    status: 'matched' as const,
    pickupAddress: 'San Martín 123',
    dropoffAddress: 'Belgrano 456',
    recipientName: 'Juan Pérez',
    recipientPhone: '3865123456',
  };

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

  it('DoD: Con push apagado, el cambio de estado se actualiza al volver a la app (focus)', async () => {
    const updatedTrip = {
      ...initialTrip,
      status: 'in_transit' as const,
    };

    const fetchMock = vi.fn().mockResolvedValue(updatedTrip);

    const { result } = renderHook(
      () =>
        useTrip('trip-1', initialTrip, {
          fetcher: fetchMock,
        }),
      { wrapper }
    );

    expect(result.current.trip?.status).toBe('matched');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.trip?.status).toBe('in_transit');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('DoD: reconexión de red (online) refetchea estado del viaje', async () => {
    const updatedTrip = {
      ...initialTrip,
      status: 'delivered' as const,
    };

    const fetchMock = vi.fn().mockResolvedValue(updatedTrip);

    const { result } = renderHook(
      () =>
        useTrip('trip-1', initialTrip, {
          fetcher: fetchMock,
        }),
      { wrapper }
    );

    expect(result.current.trip?.status).toBe('matched');

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current.trip?.status).toBe('delivered');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('DoD: al desmontar la pantalla se cierra el canal', () => {
    const { unmount } = renderHook(
      () => useTrip('trip-1', initialTrip),
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
        () => useTrip('trip-1', initialTrip),
        { wrapper }
      );

      // Simular evento Realtime
      act(() => {
        if (realtimeCallback) {
          realtimeCallback({
            eventType: 'UPDATE',
            new: { id: 'trip-1', status: 'in_transit' },
          });
        }
      });

      // No muta la caché a mano ni inyecta en el estado
      expect(setQueryDataSpy).not.toHaveBeenCalled();
      expect(result.current.trip?.status).toBe('matched');
      expect(invalidateSpy).not.toHaveBeenCalled();

      // Superar debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: tripKeys.detail('trip-1'),
      });
      expect(setQueryDataSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('PR82-H10: refetch no es un no-op y consulta la fuente viva de datos en vez de devolver initialTrip', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'trip-1', status: 'in_transit' },
            error: null,
          }),
        }),
      }),
    });

    vi.spyOn(browserClient, 'createClient').mockReturnValue({
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: mockRemoveChannel,
      from: mockFrom,
    } as unknown as ReturnType<typeof browserClient.createClient>);

    const { result } = renderHook(
      () => useTrip('trip-1', initialTrip),
      { wrapper }
    );

    expect(result.current.trip?.status).toBe('matched');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.trip?.status).toBe('in_transit');
    });

    expect(mockFrom).toHaveBeenCalledWith('delivery_requests');
  });

  it('PR82-H10: preserva el shape completo de T al actualizar el status sin recortar campos de initialTrip', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'trip-1', status: 'in_transit' },
            error: null,
          }),
        }),
      }),
    });

    vi.spyOn(browserClient, 'createClient').mockReturnValue({
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: mockRemoveChannel,
      from: mockFrom,
    } as unknown as ReturnType<typeof browserClient.createClient>);

    const { result } = renderHook(
      () => useTrip('trip-1', initialTrip),
      { wrapper }
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.trip?.status).toBe('in_transit');
    });

    // Los campos adicionales de initialTrip no se deben perder al sincronizar el estado
    expect(result.current.trip?.pickupAddress).toBe('San Martín 123');
    expect(result.current.trip?.dropoffAddress).toBe('Belgrano 456');
    expect(result.current.trip?.recipientName).toBe('Juan Pérez');
    expect(result.current.trip?.recipientPhone).toBe('3865123456');
  });

  it('PR82-H10: no revive initialTrip cuando la consulta viva resuelve a null', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    });

    vi.spyOn(browserClient, 'createClient').mockReturnValue({
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: mockRemoveChannel,
      from: mockFrom,
    } as unknown as ReturnType<typeof browserClient.createClient>);

    const { result } = renderHook(
      () => useTrip('trip-1', initialTrip),
      { wrapper }
    );

    expect(result.current.trip?.status).toBe('matched');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.trip).toBeNull();
    });
  });
});


