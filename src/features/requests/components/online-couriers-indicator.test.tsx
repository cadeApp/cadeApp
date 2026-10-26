// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

  it('muestra el número inicial sin esperar a la red', () => {
    mockFetch({ status: 200, body: { count: 3, windowMinutes: 10 } });
    renderIndicator({ initial: { count: 3, windowMinutes: 10 } });
    expect(screen.getByRole('status').textContent).toContain('3 repartidores conectados ahora');
  });

  it('con 1 usa el singular', () => {
    mockFetch({ status: 200, body: { count: 1, windowMinutes: 10 } });
    renderIndicator({ initial: { count: 1, windowMinutes: 10 } });
    expect(screen.getByRole('status').textContent).toContain('1 repartidor conectado ahora');
  });

  it('con 0 avisa que puede publicar igual', () => {
    mockFetch({ status: 200, body: { count: 0, windowMinutes: 10 } });
    renderIndicator({ initial: { count: 0, windowMinutes: 10 } });
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('No hay repartidores conectados en este momento.');
    expect(status.textContent).toContain(
      'Podés publicar igual: los que tienen avisos activos la reciben y te avisamos cuando alguien oferte.'
    );
  });

  it('sin dato inicial, lee /api/live/online-couriers', async () => {
    const fetchMock = mockFetch({ status: 200, body: { count: 2, windowMinutes: 10 } });
    renderIndicator({ initial: null });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('2 repartidores conectados ahora'));
    expect(fetchMock).toHaveBeenCalledWith('/api/live/online-couriers', { cache: 'no-store' });
  });

  it('si la lectura falla, no muestra nada', async () => {
    const fetchMock = mockFetch({ status: 500, body: { error: 'DATABASE_ERROR' } });
    const { container } = renderIndicator({ initial: null });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.textContent).toBe('');
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
