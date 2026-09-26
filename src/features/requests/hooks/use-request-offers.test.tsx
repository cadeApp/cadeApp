import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

    const fetchOffersMock = vi.fn().mockResolvedValue(updatedOffers);

    const { result } = renderHook(
      () =>
        useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers, {
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
      () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
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
        () => useRequestOffers('11111111-1111-1111-1111-111111111111', initialOffers),
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
});

