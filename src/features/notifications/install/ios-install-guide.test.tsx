import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IosInstallGuideSheet } from './ios-install-guide-sheet';
import { isIosSafariNonStandalone } from './is-ios';

describe('T-201: iOS PWA Installation Guide (T01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('DoD: isIosSafariNonStandalone detecta correctamente iOS Safari en modo navegador', () => {
    const originalNavigator = window.navigator;

    // Simular iOS Safari no standalone
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        standalone: false,
      },
      writable: true,
      configurable: true,
    });

    expect(isIosSafariNonStandalone()).toBe(true);

    // Simular Android Chrome
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        standalone: false,
      },
      writable: true,
      configurable: true,
    });

    expect(isIosSafariNonStandalone()).toBe(false);

    // Restaurar
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('DoD: IosInstallGuideSheet se monta en un Sheet con los 3 pasos, la advertencia y acción de cerrar', () => {
    const handleClose = vi.fn();
    render(<IosInstallGuideSheet open={true} onOpenChange={handleClose} />);

    // Verificar pasos mandatorios según Stitch T01
    expect(screen.getByText(/Tocá el botón Compartir/i)).toBeInTheDocument();
    expect(screen.getByText(/Elegí «Agregar a inicio»/i)).toBeInTheDocument();
    expect(screen.getByText(/Abrí cadeApp desde el ícono de tu pantalla/i)).toBeInTheDocument();

    // Advertencia de Chrome en iPhone
    expect(
      screen.getByText(/Si usás Chrome en iPhone, primero abrí este link en Safari/i)
    ).toBeInTheDocument();

    // Botón o acción de cerrar
    const closeBtn = screen.getByRole('button', { name: /Entendido|Cerrar/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
