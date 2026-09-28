import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
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

  it('DoD: botón Reintentar permite disparar revalidación manual', () => {
    render(<TestConsumer />);
    fireEvent(window, new Event('offline'));

    const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
  });
});
