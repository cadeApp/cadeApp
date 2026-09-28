import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner, OfflineFloatingCard } from './offline-banner';
import { useOfflineStatus } from './use-offline-status';

function TestConsumer({ onUnsafeAction }: { onUnsafeAction?: () => void }) {
  const { isOffline, retryConnection } = useOfflineStatus();
  return (
    <div>
      <OfflineBanner />
      <div data-testid="content-shell" className={isOffline ? 'opacity-80 grayscale-[20%]' : ''}>
        <button
          data-testid="unsafe-action-btn"
          disabled={isOffline}
          onClick={onUnsafeAction}
        >
          Enviar Oferta
        </button>
      </div>
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
    expect((screen.getByTestId('unsafe-action-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('DoD: al disparar evento offline, muestra banner T03, card flotante y deshabilita acciones no seguras', () => {
    const handleAction = vi.fn();
    render(<TestConsumer onUnsafeAction={handleAction} />);

    // Simular evento offline
    fireEvent(window, new Event('offline'));

    expect(screen.getByText(/Sin conexión. Mostramos lo último que cargó/i)).toBeTruthy();
    expect(screen.getByText(/Cuando vuelva la conexión, actualizamos solo/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeTruthy();

    const unsafeBtn = screen.getByTestId('unsafe-action-btn') as HTMLButtonElement;
    expect(unsafeBtn.disabled).toBe(true);
  });

  it('DoD: al disparar evento online, restaura estado y oculta banners', () => {
    render(<TestConsumer />);

    fireEvent(window, new Event('offline'));
    expect(screen.getByText(/Sin conexión. Mostramos lo último que cargó/i)).toBeTruthy();

    fireEvent(window, new Event('online'));
    expect(screen.queryByText(/Sin conexión. Mostramos lo último que cargó/i)).toBeNull();
    expect(screen.queryByText(/Cuando vuelva la conexión, actualizamos solo/i)).toBeNull();
    expect((screen.getByTestId('unsafe-action-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('DoD: botón Reintentar permite disparar revalidación manual', () => {
    render(<TestConsumer />);
    fireEvent(window, new Event('offline'));

    const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
  });
});
