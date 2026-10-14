// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, useQuery } from '@tanstack/react-query';
import { Providers } from './providers';

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
}

function ReconnectProbe({ queryFn }: { queryFn: () => Promise<string> }) {
  const query = useQuery({
    queryKey: ['t333', 'reconnect-probe'],
    queryFn,
    initialData: 'inicial',
    initialDataUpdatedAt: 0,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: 'always',
  });
  return <div>{query.data}</div>;
}

describe('T-333 / PR236-H01: frontera navegador → onlineManager → refetch dentro del Providers real', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  afterEach(() => {
    cleanup();
    if (originalOnLine) {
      Object.defineProperty(window.navigator, 'onLine', originalOnLine);
    } else {
      Reflect.deleteProperty(window.navigator, 'onLine');
    }
    onlineManager.setOnline(true);
  });

  it('secuencia real del defecto: tras el fetch inicial, offline → online de window produce una llamada nueva', async () => {
    const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue('servidor');

    // A–C: navegador online, singleton online, Providers real con una query activa.
    setNavigatorOnLine(true);
    onlineManager.setOnline(true);
    render(
      <Providers>
        <ReconnectProbe queryFn={queryFn} />
      </Providers>
    );

    // D: fetch inicial (initialDataUpdatedAt: 0) terminado antes del baseline.
    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(screen.getByText('servidor')).toBeDefined();
    });
    const baseline = queryFn.mock.calls.length;

    // E–F: corte de red del navegador.
    setNavigatorOnLine(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(onlineManager.isOnline()).toBe(false);

    // G–H: vuelve la red.
    setNavigatorOnLine(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(onlineManager.isOnline()).toBe(true);

    // I: TanStack refetchea por refetchOnReconnect: 'always', sin refetch manual.
    await waitFor(() => {
      expect(queryFn.mock.calls.length).toBeGreaterThan(baseline);
    });
  });
});
