// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { ONLINE_COURIERS_REFETCH_MS, useOnlineCouriers } from './use-online-couriers';

// PR551-H02: el hook real con un QueryClient que NO refresca por foco ni por reconexión; si el hook no los habilita,
// estas pruebas fallan. El fetch se simula en la frontera HTTP.

function sequenceFetch(...counts: number[]) {
  const fetchMock = vi.fn();
  for (const count of counts) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ count, windowMinutes: 10 }), { status: 200 }));
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('PR551-H02: useOnlineCouriers con el observer real', () => {
  let client: QueryClient;

  function renderOnlineCouriers() {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useOnlineCouriers({ count: 1, windowMinutes: 10 }), { wrapper });
  }

  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
      },
    });
  });

  afterEach(() => {
    cleanup();
    client.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  });

  it('no lee antes del minuto; al minuto lee y muestra el número nuevo', async () => {
    const fetchMock = sequenceFetch(2);
    const { result } = renderOnlineCouriers();
    expect(result.current.data?.count).toBe(1);

    await advance(ONLINE_COURIERS_REFETCH_MS - 1_000);
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(1_000);
    await waitFor(() => expect(result.current.data?.count).toBe(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/live/online-couriers', { cache: 'no-store' });
  });

  it('con la pantalla oculta no lee; al volver lee aunque el dato esté fresco', async () => {
    const fetchMock = sequenceFetch(3);
    const { result } = renderOnlineCouriers();

    act(() => focusManager.setFocused(false));
    await advance(ONLINE_COURIERS_REFETCH_MS * 3);
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(result.current.data?.count).toBe(3));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('al reconectarse lee aunque el dato esté fresco', async () => {
    const fetchMock = sequenceFetch(4);
    const { result } = renderOnlineCouriers();
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => onlineManager.setOnline(false));
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(result.current.data?.count).toBe(4));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
