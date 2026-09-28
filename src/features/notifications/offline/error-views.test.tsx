import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorView } from './error-view';
import { NotFoundView } from './not-found-view';

describe('T-201: Error and NotFound Views (T04)', () => {
  it('DoD: RootError debe tener diseño Stitch T04, copy es-AR, código de soporte y no exponer stack ni datos internos', () => {
    const mockReset = vi.fn();
    const sensitiveError = new Error('DATABASE_CONNECTION_POOL_EXHAUSTED at pg_client.ts:89 secret_token_xyz');

    render(<ErrorView error={sensitiveError} reset={mockReset} />);

    // Copy empático es-AR
    expect(screen.getByText(/Algo salió mal/i)).toBeTruthy();
    expect(screen.getByText(/No es tu culpa\. Probá de nuevo en unos segundos\./i)).toBeTruthy();

    // No debe exponer stack trace ni detalles técnicos sensibles
    expect(screen.queryByText(/DATABASE_CONNECTION_POOL_EXHAUSTED/i)).toBeNull();
    expect(screen.queryByText(/secret_token_xyz/i)).toBeNull();

    // Código de soporte
    expect(screen.getByText(/Código:/i)).toBeTruthy();

    // Botones de acción
    const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
    expect(mockReset).toHaveBeenCalledTimes(1);

    const homeLink = screen.getByRole('link', { name: /Ir al inicio/i });
    expect(homeLink.getAttribute('href')).toBe('/');
  });

  it('DoD: NotFound debe tener diseño consistente, copy es-AR y enlace para volver al inicio', () => {
    render(<NotFoundView />);

    expect(screen.getByText(/Página no encontrada/i)).toBeTruthy();
    expect(screen.getByText(/No encontramos lo que buscabas/i)).toBeTruthy();

    const homeLink = screen.getByRole('link', { name: /Ir al inicio/i });
    expect(homeLink.getAttribute('href')).toBe('/');
  });
});
