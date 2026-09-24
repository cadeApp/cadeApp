import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTrip } from './use-trip';
import * as browserClient from '@/lib/supabase/browser';

describe('T-204 DoD: useTrip (Active Trip TanStack Query & Realtime)', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;

  const initialTrip = {
    id: 'trip-1',
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

  it('DoD: Con push apagado, el cambio de estado se actualiza al volver a la app (focus)', async () => {
    const updatedTrip = {
      ...initialTrip,
      status: 'in_transit' as const,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(initialTrip)
      .mockResolvedValueOnce(updatedTrip);

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
});
