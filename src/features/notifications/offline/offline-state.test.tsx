import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner, OfflineFloatingCard } from './offline-banner';
import { useOfflineStatus } from './use-offline-status';

function TestConsumer() {
  const { retryConnection } = useOfflineStatus();
  return (
    <div>
      <OfflineBanner />
      <OfflineFloatingCard onRetry={retryConnection} />
    </div>
  );
}

describe('T-201: Offline State & Degradation (T03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('DoD: inicialmente online no muestra banner de sin conexión ni floating card', () => {
    render(<TestConsumer />);
    expect(screen.queryByText(/Sin conexión. Mostramos lo último que cargó/i)).toBeNull();
    expect(screen.queryByText(/Cuando vuelva la conexión, actualizamos solo/i)).toBeNull();
  });

  it('DoD: al disparar evento offline, muestra banner T03 y card flotante con reintento', () => {
    render(<TestConsumer />);

    // Simular evento offline
    fireEvent(window, new Event('offline'));

    expect(screen.getByText(/Sin conexión. Mostramos lo último que cargó/i)).toBeTruthy();
    expect(screen.getByText(/Cuando vuelva la conexión, actualizamos solo/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeTruthy();
  });

  it('DoD: al disparar evento online, restaura estado y oculta banners', () => {
    render(<TestConsumer />);

    fireEvent(window, new Event('offline'));
    expect(screen.getByText(/Sin conexión. Mostramos lo último que cargó/i)).toBeTruthy();

    fireEvent(window, new Event('online'));
    expect(screen.queryByText(/Sin conexión. Mostramos lo último que cargó/i)).toBeNull();
    expect(screen.queryByText(/Cuando vuelva la conexión, actualizamos solo/i)).toBeNull();
  });

  it('DoD / PR117-H06: botón Reintentar sincroniza todas las instancias si hay conectividad (probe HEAD exitoso)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));

    render(<TestConsumer />);
    expect(screen.getByText(/Sin conexión/i)).toBeTruthy();
    expect(screen.getByText(/Cuando vuelva la conexión/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Sin conexión/i)).toBeNull();
      expect(screen.queryByText(/Cuando vuelva la conexión/i)).toBeNull();
    });

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('DoD / PR117-H06: si probe fetch falla al reintentar, mantiene estado offline en todas las instancias', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    render(<TestConsumer />);
    expect(screen.getByText(/Sin conexión/i)).toBeTruthy();
    expect(screen.getByText(/Cuando vuelva la conexión/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText(/Sin conexión/i)).toBeTruthy();
    expect(screen.getByText(/Cuando vuelva la conexión/i)).toBeTruthy();

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('SSR: con un navigator sin onLine (Node 22) el HTML del servidor no muestra sin conexión', () => {
    // Node 22 expone `navigator` global, pero sin `onLine`: `!navigator.onLine` daba `true` y staging servía
    // la página con el banner y la card aunque hubiera red.
    Object.defineProperty(navigator, 'onLine', { value: undefined, configurable: true });
    try {
      const html = renderToString(<TestConsumer />);
      expect(html).not.toContain('Sin conexión');
      expect(html).not.toContain('Cuando vuelva la conexión');
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    }
  });
});
