import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeInvalidation } from './use-realtime-invalidation';
import * as browserClient from '@/lib/supabase/browser';

describe('T-204 DoD: useRealtimeInvalidation', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let realtimeCallbacks: Array<(payload: unknown) => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    realtimeCallbacks = [];
    mockRemoveChannel = vi.fn();
    mockSubscribe = vi.fn().mockReturnThis();
    mockOn = vi.fn().mockImplementation((_event, _filter, callback) => {
      realtimeCallbacks.push(callback);
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('DoD 1: al desmontar la pantalla se cierra el canal y se cancela el debounce pendiente', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { unmount } = renderHook(
      () =>
        useRealtimeInvalidation({
          channelName: 'offers-req-123',
          table: 'offers',
          filter: 'request_id=eq.req-123',
          queryKey: ['requests', 'detail', 'req-123', 'offers'],
          debounceMs: 300,
        }),
      { wrapper }
    );

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).not.toHaveBeenCalled();

    // Disparar evento Realtime previo a desmontar
    expect(realtimeCallbacks.length).toBeGreaterThan(0);
    realtimeCallbacks[0]?.({ eventType: 'INSERT', new: { id: 'offer-temp' } });

    // Desmontar antes de que venza el debounce (300ms)
    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);

    // Avanzar reloj: el debounce cancelado no debe disparar invalidateQueries
    vi.advanceTimersByTime(300);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('DoD 2: Realtime no escribe la caché a mano, solo invalida queries con debounce', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    renderHook(
      () =>
        useRealtimeInvalidation({
          channelName: 'offers-req-123',
          table: 'offers',
          filter: 'request_id=eq.req-123',
          queryKey: ['requests', 'detail', 'req-123', 'offers'],
          debounceMs: 300,
        }),
      { wrapper }
    );

    expect(realtimeCallbacks.length).toBeGreaterThan(0);
    const cb = realtimeCallbacks[0]!;

    // Simular 3 eventos Realtime en ráfaga (50ms entre cada uno)
    cb({ eventType: 'INSERT', new: { id: 'offer-1', amount_ars: 1500 } });
    vi.advanceTimersByTime(50);
    cb({ eventType: 'INSERT', new: { id: 'offer-2', amount_ars: 2000 } });
    vi.advanceTimersByTime(50);
    cb({ eventType: 'UPDATE', new: { id: 'offer-2', amount_ars: 1800 } });

    // Aún dentro del debounce: ninguna llamada a invalidar
    expect(invalidateSpy).not.toHaveBeenCalled();

    // Invariante de DoD: Realtime NUNCA escribe la caché a mano
    expect(setQueryDataSpy).not.toHaveBeenCalled();

    // Avanzar el tiempo más allá del debounce (300ms)
    vi.advanceTimersByTime(300);

    // Solo se debe haber llamado a invalidateQueries 1 vez por el debounce
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['requests', 'detail', 'req-123', 'offers'],
    });

    // La caché sigue sin ser manipulada manualmente
    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });

  it('DoD 3: un canal por pantalla aunque se escuchen múltiples tablas o eventos', () => {
    const supabaseMock = browserClient.createClient();
    const channelSpy = vi.spyOn(supabaseMock, 'channel');

    renderHook(
      () =>
        useRealtimeInvalidation({
          channelName: 'merchant-dashboard',
          subscriptions: [
            { table: 'delivery_requests', queryKey: ['requests'] },
            { table: 'offers', queryKey: ['offers'] },
          ],
        }),
      { wrapper }
    );

    expect(channelSpy).toHaveBeenCalledTimes(1);
    expect(channelSpy).toHaveBeenCalledWith('merchant-dashboard');
    expect(mockOn).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });
});
