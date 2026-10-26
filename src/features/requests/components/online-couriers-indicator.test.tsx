// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { OnlineCouriersIndicator } from './online-couriers-indicator';
import { ONLINE_COURIERS_REFETCH_MS, onlineCouriersQueryOptions } from '../hooks/use-online-couriers';

function renderIndicator(props: React.ComponentProps<typeof OnlineCouriersIndicator>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OnlineCouriersIndicator {...props} />
    </QueryClientProvider>
  );
}

function mockFetch(response: { status: number; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response.body), { status: response.status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('T-415: repartidores conectados ahora', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('T-417: tarjeta con el título, el número inicial sin esperar a la red y el logo de la app', () => {
    mockFetch({ status: 200, body: { count: 3, windowMinutes: 10 } });
    renderIndicator({ initial: { count: 3, windowMinutes: 10 } });
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Repartidores conectados');
    expect(status.querySelector('p')?.textContent).toBe('3');
    expect(status.textContent).toContain('3 repartidores conectados ahora');
    expect(status.querySelector('svg [data-brand-part="rider"]')).not.toBeNull();
  });

  it('con 1 usa el singular en el texto accesible', () => {
    mockFetch({ status: 200, body: { count: 1, windowMinutes: 10 } });
    renderIndicator({ initial: { count: 1, windowMinutes: 10 } });
    expect(screen.getByRole('status').textContent).toContain('1 repartidor conectado ahora');
  });

  it('con 0 muestra 0 y avisa que puede publicar igual', () => {
    mockFetch({ status: 200, body: { count: 0, windowMinutes: 10 } });
    renderIndicator({ initial: { count: 0, windowMinutes: 10 } });
    const status = screen.getByRole('status');
    expect(status.querySelector('p')?.textContent).toBe('0');
    expect(status.textContent).toContain('Podés publicar igual: te avisamos cuando alguien oferte.');
    expect(status.textContent).not.toContain('conectados ahora');
  });

  it('sin dato inicial, lee /api/live/online-couriers', async () => {
    const fetchMock = mockFetch({ status: 200, body: { count: 2, windowMinutes: 10 } });
    renderIndicator({ initial: null });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('2 repartidores conectados ahora'));
    expect(fetchMock).toHaveBeenCalledWith('/api/live/online-couriers', { cache: 'no-store' });
  });

  it('si la lectura falla, la tarjeta dice «Sin datos»', async () => {
    const fetchMock = mockFetch({ status: 500, body: { error: 'DATABASE_ERROR' } });
    renderIndicator({ initial: null });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('status').querySelector('p')?.textContent).toBe('Sin datos'));
  });

  it('se actualiza cada minuto solo con la pantalla visible y al volver a ella', () => {
    const options = onlineCouriersQueryOptions(null);
    expect(ONLINE_COURIERS_REFETCH_MS).toBe(60_000);
    expect(options).toMatchObject({
      queryKey: ['requests', 'online-couriers'],
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
    });
    expect('initialData' in options).toBe(false);
    expect(onlineCouriersQueryOptions({ count: 1, windowMinutes: 10 })).toMatchObject({
      initialData: { count: 1, windowMinutes: 10 },
    });
  });
});

describe('PR551: el indicador lee datos nuevos (polling y refresco al volver)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    focusManager.setFocused(undefined);
  });

  function sequenceFetch(...counts: number[]) {
    const fetchMock = vi.fn();
    for (const count of counts) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ count, windowMinutes: 10 }), { status: 200 }));
    }
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('cada minuto vuelve a leer y muestra el número nuevo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = sequenceFetch(5, 7);
    renderIndicator({ initial: { count: 2, windowMinutes: 10 } });
    expect(screen.getByRole('status').textContent).toContain('2 repartidores conectados ahora');
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ONLINE_COURIERS_REFETCH_MS);
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('5 repartidores conectados ahora'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ONLINE_COURIERS_REFETCH_MS);
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('7 repartidores conectados ahora'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('al volver a la pantalla lee enseguida, sin esperar el minuto', async () => {
    const fetchMock = sequenceFetch(4);
    renderIndicator({ initial: { count: 2, windowMinutes: 10 } });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('4 repartidores conectados ahora'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si un refresco falla después de mostrar un número, la query queda en error y la tarjeta dice «Sin datos»', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'DATABASE_ERROR' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <OnlineCouriersIndicator initial={{ count: 2, windowMinutes: 10 }} />
      </QueryClientProvider>
    );
    expect(screen.getByRole('status').textContent).toContain('2 repartidores conectados ahora');

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(client.getQueryState(['requests', 'online-couriers'])?.status).toBe('error'));
    expect(client.getQueryData(['requests', 'online-couriers'])).toEqual({ count: 2, windowMinutes: 10 });
    expect(container.querySelector('[role="status"] p')?.textContent).toBe('Sin datos');
    expect(container.textContent).not.toContain('conectados ahora');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
