import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTrip } from './use-trip';
import { tripKeys } from '../query-keys';
import * as browserClient from '@/lib/supabase/browser';

describe('T-204 DoD: useTrip (Active Trip TanStack Query & Realtime vía /api/live)', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let realtimeCallback: ((payload: unknown) => void) | null = null;

  const initialTrip = {
    id: '11111111-1111-1111-1111-111111111111',
    status: 'matched' as const,
    pickupAddress: 'San Martín 123',
    dropoffAddress: 'Belgrano 456',
    recipientName: 'Juan Pérez',
    recipientPhone: '3865123456',
  };

  beforeEach(() => {
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

  it('PR82-H19 (Control Estático): use-trip.ts no tiene imports de supabase/browser ni .from(', () => {
    const hookPath = path.resolve(__dirname, 'use-trip.ts');
    const sourceCode = fs.readFileSync(hookPath, 'utf8');

    expect(sourceCode).not.toContain('@/lib/supabase/browser');
    expect(sourceCode).not.toContain('.from(');
    expect(sourceCode).toContain('/api/live/trips/');
    const nonNullAssertionPattern = new RegExp('[a-zA-Z0-9_\\)\\]]!(?!=)');
    expect(sourceCode).not.toMatch(nonNullAssertionPattern);
  });

  it('DoD: Con push apagado, el cambio de estado se actualiza al volver a la app (focus)', async () => {
    const updatedTrip = {
      ...initialTrip,
      status: 'in_transit' as const,
    };

    const fetchMock = vi.fn().mockResolvedValue(updatedTrip);

    const { result } = renderHook(
      () =>
        useTrip('11111111-1111-1111-1111-111111111111', initialTrip, {
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
        useTrip('11111111-1111-1111-1111-111111111111', initialTrip, {
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
      () => useTrip('11111111-1111-1111-1111-111111111111', initialTrip),
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
        () => useTrip('11111111-1111-1111-1111-111111111111', initialTrip),
        { wrapper }
      );

      // Simular evento Realtime
      act(() => {
        if (realtimeCallback) {
          realtimeCallback({
            eventType: 'UPDATE',
            new: { id: '11111111-1111-1111-1111-111111111111', status: 'in_transit' },
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
        queryKey: tripKeys.detail('11111111-1111-1111-1111-111111111111'),
      });
      expect(setQueryDataSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('PR82-H10 / H19: refetch consume /api/live/trips/[tripId] en vez de devolver siempre initialTrip', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          status: 'in_transit',
        },
      }),
    } as Response);

    const { result } = renderHook(
      () => useTrip('11111111-1111-1111-1111-111111111111', initialTrip),
      { wrapper }
    );

    expect(result.current.trip?.status).toBe('matched');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.trip?.status).toBe('in_transit');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/live/trips/11111111-1111-1111-1111-111111111111');
  });

  it('PR82-H10: preserva el shape completo de T al actualizar el status sin recortar campos de initialTrip', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          status: 'in_transit',
        },
      }),
    } as Response);

    const { result } = renderHook(
      () => useTrip('11111111-1111-1111-1111-111111111111', initialTrip),
      { wrapper }
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.trip?.status).toBe('in_transit');
    });

    expect(result.current.trip?.pickupAddress).toBe('San Martín 123');
    expect(result.current.trip?.dropoffAddress).toBe('Belgrano 456');
    expect(result.current.trip?.recipientName).toBe('Juan Pérez');
    expect(result.current.trip?.recipientPhone).toBe('3865123456');
  });

  it('PR82-H10: no revive initialTrip cuando la consulta viva resuelve a null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: null,
      }),
    } as Response);

    const { result } = renderHook(
      () => useTrip('11111111-1111-1111-1111-111111111111', initialTrip),
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

  it('PR82-H20: cuando /api/live/trips/... responde con HTTP 500, expone isError: true', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DATABASE_ERROR' }),
    } as Response);

    const { result } = renderHook(
      () => useTrip('11111111-1111-1111-1111-111111111111', initialTrip),
      { wrapper }
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.trip).toEqual(initialTrip);
    expect(result.current.error?.message).toContain('HTTP 500');
  });
});
