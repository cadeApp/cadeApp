import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { useRequestOffers } from './use-request-offers';
import { requestKeys } from '../query-keys';
import * as browserClient from '@/lib/supabase/browser';
import type { MerchantOfferItem } from '../types';

describe('T-204 DoD: useRequestOffers con TanStack Query y Realtime vía /api/live', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let realtimeCallback: ((payload: unknown) => void) | null = null;

  const initialOffers: MerchantOfferItem[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      courierId: '22222222-2222-2222-2222-222222222222',
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

  it('PR82-H19 (Control Estático): use-request-offers.ts no tiene imports de supabase/browser ni .from(', () => {
    const hookPath = path.resolve(__dirname, 'use-request-offers.ts');
    const sourceCode = fs.readFileSync(hookPath, 'utf8');

    expect(sourceCode).not.toContain('@/lib/supabase/browser');
    expect(sourceCode).not.toContain('.from(');
    expect(sourceCode).toContain('/api/live/requests/');
    const nonNullAssertionPattern = new RegExp('[a-zA-Z0-9_\\)\\]]!(?!=)');
    expect(sourceCode).not.toMatch(nonNullAssertionPattern);
  });

  it('PR82-H26 (Control Estático): use-request-offers.ts no expone setOffers ni llama a setQueryData', () => {
    const hookPath = path.resolve(__dirname, 'use-request-offers.ts');
    const sourceCode = fs.readFileSync(hookPath, 'utf8');

    expect(sourceCode).not.toContain('setQueryData');
    expect(sourceCode).not.toContain('setOffers');
    expect(sourceCode).not.toContain('setLocalOffersState');
  });

  async function flushRealtimeSetup() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('PR82-H31 (Control Estático): use-request-offers.ts no tiene import estático runtime desde live-contracts y usa dynamic import', () => {
    const hookPath = path.resolve(__dirname, 'use-request-offers.ts');
    const sourceCode = fs.readFileSync(hookPath, 'utf8');

    expect(sourceCode).not.toMatch(
      /import\s*\{[^}]*liveOffersResponseSchema[^}]*\}\s*from\s*['"]@\/lib\/live-contracts['"]/m
    );
    expect(sourceCode).toContain("import('@/lib/live-contracts')");
  });

  it('DoD: Con el push apagado, la oferta nueva aparece al volver a la app (refetchOnWindowFocus: always)', async () => {
    const updatedOffers: MerchantOfferItem[] = [
      ...initialOffers,
      {
        id: '33333333-3333-3333-3333-333333333333',
        courierId: '44444444-4444-4444-4444-444444444444',
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
        useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers, {
          fetcher: fetchOffersMock,
        }),
      { wrapper }
    );

    expect(result.current.offers).toHaveLength(1);
    expect(result.current.offers[0]?.id).toBe('11111111-1111-1111-1111-111111111111');

    // Simular que el usuario vuelve a la app (evento window focus) sin push
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.offers).toHaveLength(2);
    });

    expect(
      result.current.offers.some(
        (o: MerchantOfferItem) => o.id === '33333333-3333-3333-3333-333333333333'
      )
    ).toBe(true);
    expect(fetchOffersMock).toHaveBeenCalledTimes(1);
  });

  it('DoD: reconexión de red (online) refetchea ofertas en vivo (refetchOnReconnect: always)', async () => {
    const updatedOffers: MerchantOfferItem[] = [
      ...initialOffers,
      {
        id: '55555555-5555-5555-5555-555555555555',
        courierId: '66666666-6666-6666-6666-666666666666',
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

    // T-333: el fetch inicial (initialDataUpdatedAt: 0) devuelve la lista vieja; solo la reconexión trae la nueva.
    const fetchOffersMock = vi
      .fn()
      .mockResolvedValueOnce(initialOffers)
      .mockResolvedValue(updatedOffers);

    try {
      const { result } = renderHook(
        () =>
          useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers, {
            fetcher: fetchOffersMock,
          }),
        { wrapper }
      );

      // 1. Esperar el fetch inicial y que la query quede quieta antes de fijar el baseline.
      await waitFor(() => {
        expect(fetchOffersMock).toHaveBeenCalledTimes(1);
        expect(result.current.isRefetching).toBe(false);
      });
      const baseline = fetchOffersMock.mock.calls.length;
      expect(result.current.offers).toHaveLength(1);

      // 2. Transición real offline -> online del onlineManager de TanStack.
      act(() => {
        onlineManager.setOnline(false);
      });
      act(() => {
        onlineManager.setOnline(true);
      });

      // 3. Exigir una llamada posterior al baseline: el fetch inicial no alcanza.
      await waitFor(() => {
        expect(fetchOffersMock.mock.calls.length).toBeGreaterThan(baseline);
      });
      await waitFor(() => {
        expect(result.current.offers).toHaveLength(2);
      });

      // 4. Exactamente una llamada adicional: TanStack es el único que refetchea en idle.
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchOffersMock).toHaveBeenCalledTimes(baseline + 1);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  describe('T-333: reconexión mientras el fetch inicial sigue en vuelo', () => {
    const requestId = '11111111-1111-1111-1111-111111111111';
    const newOffer: MerchantOfferItem = {
      id: '77777777-7777-7777-7777-777777777777',
      courierId: '88888888-8888-8888-8888-888888888888',
      courierName: 'Lucía Paz',
      vehicleType: 'bicycle',
      amountArs: 1700,
      etaMinutes: 20,
      message: null,
      licenseStatus: 'none',
      insuranceStatus: 'none',
      docLevel: 1,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    function deferred<T>() {
      let resolve: (value: T) => void = () => undefined;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    async function flushMicrotasks() {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    // La llamada #1 queda abierta hasta que el test la resuelve; las siguientes traen la oferta nueva.
    function setupInFlight() {
      const first = deferred<readonly MerchantOfferItem[]>();
      const fetcher = vi
        .fn<() => Promise<readonly MerchantOfferItem[]>>()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValue([...initialOffers, newOffer]);
      const hook = renderHook(() => useRequestOffers(requestId, initialOffers, { fetcher }), {
        wrapper,
      });
      return { first, fetcher, ...hook };
    }

    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('B: offline → online con la llamada #1 pendiente dispara exactamente una llamada #2 tras el settle', async () => {
      onlineManager.setOnline(true);
      const { first, fetcher, result } = setupInFlight();

      await waitFor(() => {
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(result.current.isRefetching).toBe(true);
      });

      act(() => {
        onlineManager.setOnline(false);
      });
      act(() => {
        onlineManager.setOnline(true);
      });
      await flushMicrotasks();

      // La #1 sigue abierta: TanStack reutiliza ese fetch (cancelRefetch: false) y no aparece una #2 todavía.
      expect(fetcher).toHaveBeenCalledTimes(1);

      await act(async () => {
        first.resolve(initialOffers);
        await first.promise;
      });

      await waitFor(() => {
        expect(fetcher).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(result.current.offers.map((o) => o.id)).toContain(newOffer.id);
      });
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('C: sin offline → online, el settle de la llamada #1 no agrega llamadas', async () => {
      onlineManager.setOnline(true);
      const { first, fetcher, result } = setupInFlight();

      await waitFor(() => {
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(result.current.isRefetching).toBe(true);
      });

      await act(async () => {
        first.resolve(initialOffers);
        await first.promise;
      });
      await waitFor(() => {
        expect(result.current.isRefetching).toBe(false);
      });
      await flushMicrotasks();

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result.current.offers).toHaveLength(1);
    });

    it('E: si tras el reconnect arranca un refetch competidor que trae datos frescos, no hay una llamada #3', async () => {
      onlineManager.setOnline(true);
      const { fetcher, result } = setupInFlight();

      await waitFor(() => {
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(result.current.isRefetching).toBe(true);
      });

      act(() => {
        onlineManager.setOnline(false);
      });
      act(() => {
        onlineManager.setOnline(true);
      });
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Con la #1 todavía abierta, un invalidate explícito (cancelRefetch: true por defecto) la reemplaza por la #2.
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: requestKeys.offers(requestId) });
      });

      await waitFor(() => {
        expect(result.current.offers.map((o) => o.id)).toContain(newOffer.id);
        expect(result.current.isRefetching).toBe(false);
      });
      await flushMicrotasks();

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('D: desmontar antes del settle no deja un refetch tardío', async () => {
      onlineManager.setOnline(true);
      const { first, fetcher, result, unmount } = setupInFlight();

      await waitFor(() => {
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(result.current.isRefetching).toBe(true);
      });

      act(() => {
        onlineManager.setOnline(false);
      });
      act(() => {
        onlineManager.setOnline(true);
      });
      unmount();

      await act(async () => {
        first.resolve(initialOffers);
        await first.promise;
      });
      await flushMicrotasks();

      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  it('DoD: al desmontar la pantalla se cierra el canal', async () => {
    const { unmount } = renderHook(
      () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
      { wrapper }
    );

    await flushRealtimeSetup();
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
        () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
        { wrapper }
      );

      await flushRealtimeSetup();

      expect(realtimeCallback).toBeTypeOf('function');

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
      expect(setQueryDataSpy).not.toHaveBeenCalled();
      expect(result.current.offers).toHaveLength(1);
      expect(invalidateSpy).not.toHaveBeenCalled();

      // Avanzar reloj para superar el debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: requestKeys.offers('11111111-1111-1111-1111-111111111111'),
      });
      expect(setQueryDataSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('PR82-H13: onOfferAdded y onOfferUpdated se ejecutan en useEffect posterior al render (no durante el render)', async () => {
    const executionPhases: string[] = [];
    const addedOffers: MerchantOfferItem[] = [];

    const newOffer: MerchantOfferItem = {
      id: '77777777-7777-7777-7777-777777777777',
      courierId: '88888888-8888-8888-8888-888888888888',
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
        const res = useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers, {
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

    expect(addedOffers).toHaveLength(0);
    executionPhases.length = 0;

    fetchResults = [...initialOffers, newOffer];
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.offers).toHaveLength(2);
    });

    expect(executionPhases).toEqual(['start-render', 'end-render', 'callback']);
    expect(addedOffers).toHaveLength(1);
    expect(addedOffers[0]?.id).toBe('77777777-7777-7777-7777-777777777777');
  });

  it('PR82-H19: el fetch por defecto consume /api/live/requests/[requestId]/offers', async () => {
    const liveApiPayload = {
      data: [
        {
          id: '99999999-9999-9999-9999-999999999999',
          courierId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          courierName: 'Roberto M.',
          vehicleType: 'motorcycle',
          amountArs: 2000,
          etaMinutes: 10,
          message: null,
          licenseStatus: 'verified',
          insuranceStatus: 'verified',
          docLevel: 2,
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
      ],
      nextCursor: null,
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => liveApiPayload,
    } as Response);

    const { result } = renderHook(
      () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
      { wrapper }
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.offers[0]?.id).toBe('99999999-9999-9999-9999-999999999999');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/live/requests/11111111-1111-1111-1111-111111111111/offers',
      { cache: 'no-store' }
    );
  });

  it('PR82-H20: cuando /api/live/requests/.../offers responde con HTTP 500, expone isError: true', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DATABASE_ERROR' }),
    } as Response);

    const { result } = renderHook(
      () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
      { wrapper }
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.offers).toHaveLength(1);
    expect(result.current.error?.message).toContain('HTTP 500');
  });

  describe('PR82-H28: Paginación keyset en ofertas de la solicitud', () => {
    const requestId = '11111111-1111-1111-1111-111111111111';
    const cursor = {
      createdAt: '2026-09-26T12:00:00.000Z',
      id: '22222222-2222-2222-2222-222222222222',
    };

    it('render inicial con initialData expone initialOffers y hasNextPage según cursor', () => {
      const { result: withoutCursor } = renderHook(
        () => useRequestOffers(requestId, initialOffers, null),
        { wrapper }
      );
      expect(withoutCursor.current.offers).toHaveLength(1);
      expect(withoutCursor.current.hasNextPage).toBe(false);

      queryClient.clear();

      const { result: withCursor } = renderHook(
        () => useRequestOffers(requestId, initialOffers, cursor),
        { wrapper }
      );
      expect(withCursor.current.offers).toHaveLength(1);
      expect(withCursor.current.hasNextPage).toBe(true);
    });

    it('fetchNextPage llama a endpoint con cursorCreatedAt y cursorId en searchParams', async () => {
      const page2Offer: MerchantOfferItem = {
        id: '44444444-4444-4444-4444-444444444444',
        courierId: '55555555-5555-5555-5555-555555555555',
        courierName: 'Lucas B.',
        vehicleType: 'motorcycle',
        amountArs: 1900,
        etaMinutes: 12,
        message: null,
        licenseStatus: 'verified',
        insuranceStatus: 'none',
        docLevel: 1,
        createdAt: '2026-09-26T11:55:00.000Z',
        status: 'pending',
      };

      const { result } = renderHook(
        () => useRequestOffers(requestId, initialOffers, cursor),
        { wrapper }
      );

      expect(result.current.hasNextPage).toBe(true);

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [page2Offer],
          nextCursor: null,
        }),
      } as Response);

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.offers).toHaveLength(2);
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/live/requests/${requestId}/offers?cursorCreatedAt=${encodeURIComponent(
          cursor.createdAt
        )}&cursorId=${cursor.id}`,
        { cache: 'no-store' }
      );
      expect(result.current.hasNextPage).toBe(false);
    });

    it('los ítems de la siguiente página se concatenan y deduplican por id sin mutar la caché', async () => {
      const duplicateFirstItem = { ...initialOffers[0] };
      const uniqueSecondItem: MerchantOfferItem = {
        id: '66666666-6666-6666-6666-666666666666',
        courierId: '77777777-7777-7777-7777-777777777777',
        courierName: 'Ana V.',
        vehicleType: 'bicycle',
        amountArs: 1300,
        etaMinutes: 25,
        message: null,
        licenseStatus: 'none',
        insuranceStatus: 'none',
        docLevel: 0,
        createdAt: '2026-09-26T11:50:00.000Z',
        status: 'pending',
      };

      const { result } = renderHook(
        () => useRequestOffers(requestId, initialOffers, cursor),
        { wrapper }
      );

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [duplicateFirstItem, uniqueSecondItem],
          nextCursor: null,
        }),
      } as Response);

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.offers).toHaveLength(2);
      });

      const firstOfferId = initialOffers[0]?.id;
      expect(result.current.offers.map((o) => o.id)).toEqual([
        firstOfferId,
        uniqueSecondItem.id,
      ]);
    });

    it('control estático: use-request-offers.ts no tiene setQueryData, no tiene setOffers y no tiene non-null assertions', () => {
      const hookPath = path.resolve(__dirname, 'use-request-offers.ts');
      const sourceCode = fs.readFileSync(hookPath, 'utf8');

      expect(sourceCode).not.toContain('setQueryData');
      expect(sourceCode).not.toContain('setOffers');
      const nonNullAssertionPattern = new RegExp('[a-zA-Z0-9_\\)\\]]!(?!=)');
      expect(sourceCode).not.toMatch(nonNullAssertionPattern);
    });
  });

  describe('PR390-H13: señal de ofertas sincronizadas post-reconexión (offersSyncedAfterReconnect)', () => {
    it('primer montaje online: offersSyncedAfterReconnect es true inicialmente', () => {
      onlineManager.setOnline(true);
      const { result } = renderHook(
        () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
        { wrapper }
      );
      expect(result.current.isOnline).toBe(true);
      expect(result.current.offersSyncedAfterReconnect).toBe(true);
    });

    it('al pasar a offline: offersSyncedAfterReconnect pasa a false', () => {
      onlineManager.setOnline(true);
      const { result } = renderHook(
        () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
        { wrapper }
      );

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.offersSyncedAfterReconnect).toBe(false);
    });

    it('al reconectar con fetch diferido: permanece false hasta que la consulta post-reconexión resuelve con éxito', async () => {
      onlineManager.setOnline(true);
      let resolveFetch: ((value: Response) => void) | null = null;
      const deferredFetch = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      const { result } = renderHook(
        () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
        { wrapper }
      );

      act(() => {
        onlineManager.setOnline(false);
      });
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      vi.spyOn(global, 'fetch').mockImplementation(() => deferredFetch);

      act(() => {
        onlineManager.setOnline(true);
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      await act(async () => {
        if (resolveFetch) {
          resolveFetch({
            ok: true,
            status: 200,
            json: async () => ({
              data: [...initialOffers],
              nextCursor: null,
            }),
          } as Response);
        }
        await deferredFetch;
      });

      await waitFor(() => {
        expect(result.current.offersSyncedAfterReconnect).toBe(true);
      });
    });

    it('si el fetch post-reconexión falla (HTTP 500 / Zod inválido), offersSyncedAfterReconnect permanece false', async () => {
      onlineManager.setOnline(true);
      const { result } = renderHook(
        () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
        { wrapper }
      );

      act(() => {
        onlineManager.setOnline(false);
      });
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      act(() => {
        onlineManager.setOnline(true);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.offersSyncedAfterReconnect).toBe(false);
    });

    it('dos ciclos de corte: fetch iniciado antes del corte que termina tarde NO autoriza la sincronización', async () => {
      onlineManager.setOnline(true);
      let resolveOldFetch: ((value: Response) => void) | null = null;
      const oldFetchPromise = new Promise<Response>((resolve) => {
        resolveOldFetch = resolve;
      });

      vi.spyOn(global, 'fetch').mockImplementationOnce(() => oldFetchPromise);

      const { result } = renderHook(
        () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
        { wrapper }
      );

      void result.current.refetch();

      act(() => {
        onlineManager.setOnline(false);
      });
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      let resolveNewFetch: ((value: Response) => void) | null = null;
      const newFetchPromise = new Promise<Response>((resolve) => {
        resolveNewFetch = resolve;
      });
      vi.spyOn(global, 'fetch').mockImplementation(() => newFetchPromise);

      act(() => {
        onlineManager.setOnline(true);
      });

      await act(async () => {
        if (resolveOldFetch) {
          resolveOldFetch({
            ok: true,
            status: 200,
            json: async () => ({
              data: [...initialOffers],
              nextCursor: null,
            }),
          } as Response);
        }
        await oldFetchPromise;
      });

      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      await act(async () => {
        if (resolveNewFetch) {
          resolveNewFetch({
            ok: true,
            status: 200,
            json: async () => ({
              data: [...initialOffers],
              nextCursor: null,
            }),
          } as Response);
        }
        await newFetchPromise;
      });

      await waitFor(() => {
        expect(result.current.offersSyncedAfterReconnect).toBe(true);
      });
    });

    it('limpieza de listener de onlineManager al desmontar', () => {
      const subscribeSpy = vi.spyOn(onlineManager, 'subscribe');
      const { unmount } = renderHook(
        () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
        { wrapper }
      );

      expect(subscribeSpy).toHaveBeenCalled();
      unmount();
    });
  });

  describe('PR390-H16: sincronización multipágina post-reconexión (2+ páginas)', () => {
    const requestId = '11111111-1111-1111-1111-111111111111';

    const offerPage1: MerchantOfferItem = {
      id: '11111111-1111-1111-1111-111111111111',
      courierId: '22222222-2222-2222-2222-222222222222',
      courierName: 'Carlos Gómez',
      vehicleType: 'motorcycle',
      amountArs: 1500,
      etaMinutes: 15,
      message: null,
      licenseStatus: 'verified',
      insuranceStatus: 'verified',
      docLevel: 2,
      createdAt: '2026-10-18T10:00:00.000Z',
      status: 'pending',
    };

    const cursor1 = {
      createdAt: '2026-10-18T10:00:00.000Z',
      id: '11111111-1111-1111-1111-111111111111',
    };

    const offerX: MerchantOfferItem = {
      id: '99999999-9999-9999-9999-999999999999',
      courierId: '88888888-8888-8888-8888-888888888888',
      courierName: 'Marcos Ruiz',
      vehicleType: 'bicycle',
      amountArs: 1600,
      etaMinutes: 12,
      message: null,
      licenseStatus: 'verified',
      insuranceStatus: 'none',
      docLevel: 1,
      createdAt: '2026-10-18T09:55:00.000Z',
      status: 'pending',
    };

    function deferred<T>() {
      let resolve: (value: T) => void = () => undefined;
      let reject: (reason?: unknown) => void = () => undefined;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('con 2 páginas cargadas, durante el refetch post-reconexión mientras página 2 está en vuelo, offersSyncedAfterReconnect es false', async () => {
      onlineManager.setOnline(true);

      // 1. Fetcher inicial: página 2 devuelve offerX
      const fetcher = vi.fn().mockImplementation(async (cursor) => {
        if (cursor) {
          return { data: [offerX], nextCursor: null };
        }
        return { data: [offerPage1], nextCursor: cursor1 };
      });

      const { result } = renderHook(
        () => useRequestOffers(requestId, [offerPage1], cursor1, { fetcher }),
        { wrapper }
      );

      // Cargar la página 2
      expect(result.current.hasNextPage).toBe(true);
      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.offers).toHaveLength(2);
        expect(result.current.hasNextPage).toBe(false);
      });
      expect(result.current.offersSyncedAfterReconnect).toBe(true);
      expect(result.current.offers.some((o) => o.id === offerX.id)).toBe(true);

      // 2. El usuario pasa a offline (corte de red)
      act(() => {
        onlineManager.setOnline(false);
      });
      expect(result.current.isOnline).toBe(false);
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      // 3. Preparar el refetch post-reconexión:
      // En la base de datos el cadete canceló su oferta (offerX ya no es pending, excluida).
      // TanStack refetchea página 1 (resuelve inmediato) y luego página 2 (diferida).
      const deferredPage2 = deferred<{ data: MerchantOfferItem[]; nextCursor: null }>();
      const reconnectEpoch = Date.now();

      fetcher.mockImplementation(async (cursor) => {
        if (!cursor) {
          return { data: [offerPage1], nextCursor: cursor1 };
        }
        return deferredPage2.promise;
      });

      // 4. Reconexión: pasar a online
      act(() => {
        onlineManager.setOnline(true);
      });
      expect(result.current.isOnline).toBe(true);

      // Esperar a que página 1 termine y página 2 quede en vuelo
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('fetching');
      });

      // PR390-H16: Durante este intervalo, la caché vieja todavía contiene offerX,
      // pero offersSyncedAfterReconnect DEBE permanecer false para bloquear aceptación.
      expect(result.current.offersSyncedAfterReconnect).toBe(false);
      expect(result.current.offers.some((o) => o.id === offerX.id)).toBe(true);

      // 5. Asentar página 2 con éxito (sin offerX)
      await act(async () => {
        deferredPage2.resolve({ data: [], nextCursor: null });
        await deferredPage2.promise;
      });

      // Ahora que toda la consulta infinita terminó con éxito, pasa a idle y se habilita el gate
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
        expect(result.current.offersSyncedAfterReconnect).toBe(true);
      });

      expect(result.current.offers.some((o) => o.id === offerX.id)).toBe(false);
      expect(result.current.dataUpdatedAt).toBeGreaterThanOrEqual(reconnectEpoch);
    });

    it('variante: fallo HTTP 500 en la página 2 mantiene offersSyncedAfterReconnect false; reintento exitoso lo habilita', async () => {
      onlineManager.setOnline(true);

      const fetcher = vi.fn().mockImplementation(async (cursor) => {
        if (cursor) {
          return { data: [offerX], nextCursor: null };
        }
        return { data: [offerPage1], nextCursor: cursor1 };
      });

      const { result } = renderHook(
        () => useRequestOffers(requestId, [offerPage1], cursor1, { fetcher }),
        { wrapper }
      );

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.offers).toHaveLength(2);
      });
      expect(result.current.offersSyncedAfterReconnect).toBe(true);

      // Corte offline
      act(() => {
        onlineManager.setOnline(false);
      });
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      // En el refetch, la página 2 falla con error
      fetcher.mockImplementation(async (cursor) => {
        if (!cursor) {
          return { data: [offerPage1], nextCursor: cursor1 };
        }
        throw new Error('HTTP 500: Database error on page 2');
      });

      act(() => {
        onlineManager.setOnline(true);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      // Ahora reintentar la consulta con respuesta exitosa para ambas páginas
      fetcher.mockImplementation(async (cursor) => {
        if (!cursor) {
          return { data: [offerPage1], nextCursor: cursor1 };
        }
        return { data: [], nextCursor: null };
      });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(false);
        expect(result.current.offersSyncedAfterReconnect).toBe(true);
      });
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.offers.some((o) => o.id === offerX.id)).toBe(false);
    });

    it('variante cortes sucesivos: fetch anterior diferido que termina tarde NO autoriza la sincronización multipágina', async () => {
      onlineManager.setOnline(true);

      const fetcher = vi.fn().mockImplementation(async (cursor) => {
        if (cursor) {
          return { data: [offerX], nextCursor: null };
        }
        return { data: [offerPage1], nextCursor: cursor1 };
      });

      const { result } = renderHook(
        () => useRequestOffers(requestId, [offerPage1], cursor1, { fetcher }),
        { wrapper }
      );

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.offers).toHaveLength(2);
      });

      // Se dispara un refetch manual que queda bloqueado
      const deferredStaleFetch = deferred<{ data: MerchantOfferItem[]; nextCursor: typeof cursor1 }>();
      fetcher.mockImplementationOnce(async () => deferredStaleFetch.promise);

      void result.current.refetch();

      // Durante el fetch, corte offline
      act(() => {
        onlineManager.setOnline(false);
      });
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      // Preparar el fetch post-reconexión nuevo
      const deferredFreshPage1 = deferred<{ data: MerchantOfferItem[]; nextCursor: typeof cursor1 }>();
      const deferredFreshPage2 = deferred<{ data: MerchantOfferItem[]; nextCursor: null }>();

      fetcher.mockImplementation(async (cursor) => {
        if (!cursor) {
          return deferredFreshPage1.promise;
        }
        return deferredFreshPage2.promise;
      });

      // Reconectar a online
      act(() => {
        onlineManager.setOnline(true);
      });
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      // Resuelve el fetch anterior tardío (pre-reconexión)
      await act(async () => {
        deferredStaleFetch.resolve({ data: [offerPage1], nextCursor: cursor1 });
        await deferredStaleFetch.promise;
      });

      // El fetch tardío NO debe desbloquear la sincronización
      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      // Ahora resolver el fetch post-reconexión completo (página 1 y 2)
      await act(async () => {
        deferredFreshPage1.resolve({ data: [offerPage1], nextCursor: cursor1 });
        await deferredFreshPage1.promise;
      });

      expect(result.current.offersSyncedAfterReconnect).toBe(false);

      await act(async () => {
        deferredFreshPage2.resolve({ data: [], nextCursor: null });
        await deferredFreshPage2.promise;
      });

      await waitFor(() => {
        expect(result.current.offersSyncedAfterReconnect).toBe(true);
      });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

