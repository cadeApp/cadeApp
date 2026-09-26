import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAvailableRequests } from './use-available-requests';
import { offerKeys } from '../query-keys';
import * as browserClient from '@/lib/supabase/browser';
import type { AvailableRequestItem } from '../schemas';

describe('T-204 DoD: useAvailableRequests (Courier Feed TanStack Query & Realtime via /api/live)', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let realtimeCallback: ((payload: unknown) => void) | null = null;

  const initialRequests: AvailableRequestItem[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
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

  it('PR82-H19 (Control Estático): use-available-requests.ts no tiene imports de supabase/browser ni .from(', () => {
    const hookPath = path.resolve(__dirname, 'use-available-requests.ts');
    const sourceCode = fs.readFileSync(hookPath, 'utf8');

    expect(sourceCode).not.toContain('@/lib/supabase/browser');
    expect(sourceCode).not.toContain('.from(');
    expect(sourceCode).toContain('/api/live/available-requests');
    // Sin non-null assertions (!)
    const nonNullAssertionPattern = new RegExp('[a-zA-Z0-9_\\)\\]]!(?!=)');
    expect(sourceCode).not.toMatch(nonNullAssertionPattern);
  });

  it('DoD: Con push apagado, nuevas solicitudes aparecen al volver a la app (focus)', async () => {
    const updatedRequests: AvailableRequestItem[] = [
      ...initialRequests,
      {
        id: '22222222-2222-2222-2222-222222222222',
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

    expect(
      result.current.requests.some(
        (r: AvailableRequestItem) => r.id === '22222222-2222-2222-2222-222222222222'
      )
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('DoD: reconexión de red (online) refetchea feed en vivo', async () => {
    const updatedRequests: AvailableRequestItem[] = [
      ...initialRequests,
      {
        id: '33333333-3333-3333-3333-333333333333',
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

  it('PR82-H07: polling periódico de 30 s activo solo en primer plano y detenido en background', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn().mockResolvedValue(initialRequests);

      renderHook(
        () =>
          useAvailableRequests(initialRequests, {
            fetcher: fetchMock,
          }),
        { wrapper }
      );

      const initialCount = fetchMock.mock.calls.length;

      // Avanzar 29 segundos: no debe haber polling todavía
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(initialCount);

      // Completar los 30 segundos en primer plano: se dispara el polling (+1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(initialCount + 1);

      // Simular cambio a background (pantalla oculta)
      const originalVisibilityState = document.visibilityState;
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      window.dispatchEvent(new Event('visibilitychange'));

      // Avanzar otros 30 segundos en background: NO debe ejecutarse polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(initialCount + 1);

      // Restaurar visibilidad
      Object.defineProperty(document, 'visibilityState', {
        value: originalVisibilityState,
        configurable: true,
      });
      window.dispatchEvent(new Event('visibilitychange'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('PR82-H09 / H19: el fetch consume /api/live/available-requests y mapea hasMyOffer y myOfferAmountArs', async () => {
    const liveApiPayload = {
      data: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          pickupZoneName: 'Centro',
          dropoffZoneName: 'Aguilares',
          approxDistanceKm: '2,0',
          packageType: 'small',
          recipientPaymentMethod: 'cash',
          needsChange: false,
          cashChangeAmount: null,
          notes: null,
          publishedAt: '2026-09-26T00:00:00Z',
          expiresAt: null,
          hasMyOffer: true,
          myOfferAmountArs: 1500,
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => liveApiPayload,
    } as Response);

    const { result } = renderHook(
      () => useAvailableRequests(initialRequests),
      { wrapper }
    );

    // Inicialmente initialRequests tiene hasMyOffer: false
    expect(result.current.requests[0]?.hasMyOffer).toBe(false);

    // Disparar refetch vía focus
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.requests[0]?.hasMyOffer).toBe(true);
    });

    expect(result.current.requests[0]?.myOfferAmountArs).toBe(1500);
    expect(global.fetch).toHaveBeenCalledWith('/api/live/available-requests', {
      cache: 'no-store',
    });
  });

  it('PR82-H20: cuando /api/live falla (HTTP 500), expone isError: true sin fallback silencioso', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DATABASE_ERROR' }),
    } as Response);

    const { result } = renderHook(
      () => useAvailableRequests(initialRequests),
      { wrapper }
    );

    // Disparar refetch vía focus
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Mantiene initialRequests en cache pero marca error para que la UI informe
    expect(result.current.requests).toHaveLength(1);
    expect(result.current.error?.message).toContain('HTTP 500');
  });
});
