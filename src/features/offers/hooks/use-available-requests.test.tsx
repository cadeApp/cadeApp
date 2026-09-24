import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAvailableRequests } from './use-available-requests';
import * as browserClient from '@/lib/supabase/browser';
import type { AvailableRequestItem } from '../schemas';

describe('T-204 DoD: useAvailableRequests (Courier Feed TanStack Query & Realtime)', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;

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
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
        },
      },
    });

    mockRemoveChannel = vi.fn();
    mockSubscribe = vi.fn().mockReturnThis();
    mockOn = vi.fn().mockReturnValue({ subscribe: mockSubscribe });

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

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(initialRequests)
      .mockResolvedValueOnce(updatedRequests);

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

    expect(result.current.requests.some((r) => r.id === 'req-2')).toBe(true);
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
});
