import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import RootError from '@/app/error';
import NotFound from '@/app/not-found';

describe('T-201: Error and NotFound Views (T04)', () => {
  it('DoD: RootError debe tener diseño Stitch T04, copy es-AR, código de soporte y no exponer stack ni datos internos', () => {
    const mockReset = vi.fn();
    const sensitiveError = new Error('DATABASE_CONNECTION_POOL_EXHAUSTED at pg_client.ts:89 secret_token_xyz');

    render(<RootError error={sensitiveError} reset={mockReset} />);

    // Copy empático es-AR
    expect(screen.getByText(/Algo salió mal/i)).toBeInTheDocument();
    expect(screen.getByText(/No es tu culpa\. Probá de nuevo en unos segundos\./i)).toBeInTheDocument();

    // No debe exponer stack trace ni detalles técnicos sensibles
    expect(screen.queryByText(/DATABASE_CONNECTION_POOL_EXHAUSTED/i)).toBeNull();
    expect(screen.queryByText(/secret_token_xyz/i)).toBeNull();

    // Código de soporte
    expect(screen.getByText(/Código:/i)).toBeInTheDocument();

    // Botones de acción
    const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(mockReset).toHaveBeenCalledTimes(1);

    const homeLink = screen.getByRole('link', { name: /Ir al inicio/i });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('DoD: NotFound debe tener diseño consistente, copy es-AR y enlace para volver al inicio', () => {
    render(<NotFound />);

    expect(screen.getByText(/Página no encontrada/i)).toBeInTheDocument();
    expect(screen.getByText(/No encontramos lo que buscabas/i)).toBeInTheDocument();

    const homeLink = screen.getByRole('link', { name: /Ir al inicio/i });
    expect(homeLink).toHaveAttribute('href', '/');
  });
});
