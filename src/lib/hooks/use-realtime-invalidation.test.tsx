import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeInvalidation } from './use-realtime-invalidation';
import * as browserClient from '@/lib/supabase/browser';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('T-204 DoD: useRealtimeInvalidation', () => {
  let queryClient: QueryClient;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let realtimeCallbacks: Array<(payload: unknown) => void> = [];
  let statusCallback: ((status: string, err?: Error) => void) | null = null;

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
    statusCallback = null;
    mockSubscribe = vi.fn().mockImplementation((callback?: (status: string) => void) => {
      statusCallback = callback ?? null;
      return mockChannel;
    });
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

  async function flushRealtimeSetup() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('DoD 1: al desmontar la pantalla se cierra el canal y se cancela el debounce pendiente', async () => {
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

    await flushRealtimeSetup();

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

    await flushRealtimeSetup();

    expect(realtimeCallbacks.length).toBeGreaterThan(0);
    const cb = realtimeCallbacks[0];
    expect(cb).toBeDefined();

    // Simular 3 eventos Realtime en ráfaga (50ms entre cada uno)
    cb?.({ eventType: 'INSERT', new: { id: 'offer-1', amount_ars: 1500 } });
    vi.advanceTimersByTime(50);
    cb?.({ eventType: 'INSERT', new: { id: 'offer-2', amount_ars: 2000 } });
    vi.advanceTimersByTime(50);
    cb?.({ eventType: 'UPDATE', new: { id: 'offer-2', amount_ars: 1800 } });

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

  it('DoD 3: un canal por pantalla aunque se escuchen múltiples tablas o eventos', async () => {
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

    await flushRealtimeSetup();

    expect(channelSpy).toHaveBeenCalledTimes(1);
    expect(channelSpy).toHaveBeenCalledWith('merchant-dashboard');
    expect(mockOn).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('PR82-H11: debounce multi-key acumula queryKeys distintas e invalida todas al vencer la ventana', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(
      () =>
        useRealtimeInvalidation({
          channelName: 'merchant-dashboard',
          subscriptions: [
            { table: 'delivery_requests', queryKey: ['requests'] },
            { table: 'offers', queryKey: ['offers'] },
          ],
          debounceMs: 300,
        }),
      { wrapper }
    );

    await flushRealtimeSetup();

    expect(realtimeCallbacks.length).toBe(2);
    const cbA = realtimeCallbacks[0]; // delivery_requests -> ['requests']
    const cbB = realtimeCallbacks[1]; // offers -> ['offers']
    expect(cbA).toBeDefined();
    expect(cbB).toBeDefined();

    // Disparar callback A ['requests']
    cbA?.({ eventType: 'INSERT', new: { id: 'req-1' } });
    vi.advanceTimersByTime(50);

    // +50ms: Disparar callback B ['offers']
    cbB?.({ eventType: 'INSERT', new: { id: 'off-1' } });

    // Aún en la ventana: no hay invalidaciones
    expect(invalidateSpy).not.toHaveBeenCalled();

    // +300ms: Vence la ventana
    vi.advanceTimersByTime(300);

    // Ambas invalidaciones deben ejecutarse, exactamente una por cada key
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['requests'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['offers'] });
  });

  it('PR82-H12: reconfigura la suscripción cuando cambian filtro/key con el mismo channelName', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    type HookProps = {
      channelName: string;
      table: string;
      filter: string;
      queryKey: string[];
    };

    const initialProps: HookProps = {
      channelName: 'reconfig-channel',
      table: 'offers',
      filter: 'request_id=eq.req-A',
      queryKey: ['offers', 'req-A'],
    };

    const { rerender } = renderHook(
      (props: HookProps) =>
        useRealtimeInvalidation({
          ...props,
          debounceMs: 300,
        }),
      {
        wrapper,
        initialProps,
      }
    );

    await flushRealtimeSetup();

    // Al montar se suscribe con filtro A
    expect(mockOn).toHaveBeenLastCalledWith(
      'postgres_changes',
      expect.objectContaining({ filter: 'request_id=eq.req-A' }),
      expect.any(Function)
    );

    // Rerender con nuevo filtro y nueva key (mismo canal)
    rerender({
      channelName: 'reconfig-channel',
      table: 'offers',
      filter: 'request_id=eq.req-B',
      queryKey: ['offers', 'req-B'],
    });

    await flushRealtimeSetup();

    // Se debe haber reconfigurado la suscripción con filtro B
    expect(mockOn).toHaveBeenLastCalledWith(
      'postgres_changes',
      expect.objectContaining({ filter: 'request_id=eq.req-B' }),
      expect.any(Function)
    );

    // Obtener el callback de la nueva suscripción B y disparar evento
    const latestCallback = realtimeCallbacks[realtimeCallbacks.length - 1];
    expect(latestCallback).toBeDefined();
    latestCallback?.({ eventType: 'INSERT', new: { id: 'off-b' } });

    vi.advanceTimersByTime(300);

    // Debe invalidar la nueva key ['offers', 'req-B'], nunca la vieja ['offers', 'req-A']
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['offers', 'req-B'] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['offers', 'req-A'] });
  });

  it('PR82-H31 (Control Estático): no existe import estático runtime desde @/lib/supabase/browser y sí existe lazy import()', () => {
    const hookPath = resolve(__dirname, 'use-realtime-invalidation.ts');
    const sourceCode = readFileSync(hookPath, 'utf8');

    expect(sourceCode).not.toMatch(
      /import\s+[^;]*from\s+['"]@\/lib\/supabase\/browser['"]/m
    );
    expect(sourceCode).toContain("import('@/lib/supabase/browser')");
  });

  it('PR82-H31: carrera unmount-before-import no suscribe canales ni dispara invalidaciones tardías', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { unmount } = renderHook(
      () =>
        useRealtimeInvalidation({
          channelName: 'race-channel',
          table: 'offers',
          queryKey: ['offers'],
          debounceMs: 300,
        }),
      { wrapper }
    );

    // Desmontar INMEDIATAMENTE antes de flushRealtimeSetup
    unmount();

    // Ahora permitir que resuelva el import() diferido
    await flushRealtimeSetup();

    // El canal no debió ser suscrito porque disposed era true
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(mockRemoveChannel).not.toHaveBeenCalled();

    // Avanzar temporizadores: ninguna invalidación tardía
    vi.advanceTimersByTime(500);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  describe('T-333: catch-up de invalidación al quedar SUBSCRIBED', () => {
    const offersKey = ['requests', 'detail', 'req-333', 'offers'] as const;
    const detailKey = ['requests', 'detail', 'req-333'] as const;

    function renderReadinessHook() {
      return renderHook(
        () =>
          useRealtimeInvalidation({
            channelName: 'offers-req-333',
            subscriptions: [
              { table: 'offers', filter: 'request_id=eq.req-333', queryKey: offersKey },
              { table: 'delivery_requests', filter: 'id=eq.req-333', queryKey: detailKey },
            ],
            debounceMs: 300,
          }),
        { wrapper }
      );
    }

    it('antes de readiness no invalida; SUBSCRIBED invalida todas las keys del canal tras el debounce y nunca escribe la caché', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      renderReadinessHook();
      await flushRealtimeSetup();

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(statusCallback).toBeTypeOf('function');

      // Setup completo pero el canal todavía no está listo: no hay catch-up.
      vi.advanceTimersByTime(1000);
      expect(invalidateSpy).not.toHaveBeenCalled();

      act(() => {
        statusCallback?.('SUBSCRIBED');
      });

      // Programado, pero respeta el debounce.
      vi.advanceTimersByTime(299);
      expect(invalidateSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: offersKey });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: detailKey });
      expect(setQueryDataSpy).toHaveBeenCalledTimes(0);
    });

    it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])(
      'un status %s no dispara invalidación',
      async (status) => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        renderReadinessHook();
        await flushRealtimeSetup();
        expect(statusCallback).toBeTypeOf('function');

        act(() => {
          statusCallback?.(status);
        });
        vi.advanceTimersByTime(1000);

        expect(invalidateSpy).not.toHaveBeenCalled();
      }
    );

    it('un SUBSCRIBED tardío después de desmontar no invalida', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { unmount } = renderReadinessHook();
      await flushRealtimeSetup();
      expect(statusCallback).toBeTypeOf('function');
      unmount();

      statusCallback?.('SUBSCRIBED');
      vi.advanceTimersByTime(1000);

      expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
