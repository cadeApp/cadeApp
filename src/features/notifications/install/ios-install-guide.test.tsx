import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IosInstallGuideSheet } from './ios-install-guide-sheet';
import { isIosSafariNonStandalone } from './is-ios';
import { isStandalone } from './is-standalone';

vi.mock('./is-standalone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./is-standalone')>();
  return {
    ...actual,
    isStandalone: vi.fn(actual.isStandalone),
  };
});

describe('T-201: iOS PWA Installation Guide (T01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('DoD: isIosSafariNonStandalone detecta correctamente iOS Safari en modo navegador y descarta otros navegadores iOS', () => {
    const originalNavigator = window.navigator;
    const setNavigator = (userAgent: string, standalone: boolean) => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent,
          standalone,
        },
        writable: true,
        configurable: true,
      });
    };

    try {
      // Caso A — Safari iPhone, navegador
      setNavigator(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        false
      );
      expect(isIosSafariNonStandalone()).toBe(true);

      // Caso B — Chrome iPhone
      setNavigator(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.69 Mobile/15E148 Safari/604.1',
        false
      );
      expect(isIosSafariNonStandalone()).toBe(false);

      // Caso C — Firefox iPhone
      setNavigator(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
        false
      );
      expect(isIosSafariNonStandalone()).toBe(false);

      // Caso D — Safari ya instalado
      setNavigator(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        true
      );
      expect(isIosSafariNonStandalone()).toBe(false);

      // Caso E — Android Chrome
      setNavigator(
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        false
      );
      expect(isIosSafariNonStandalone()).toBe(false);
    } finally {
      Object.defineProperty(window, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it('PR295-H04 DoD: isIosSafariNonStandalone utiliza isStandalone() como única fuente de verdad (test discriminante)', () => {
    const originalNavigator = window.navigator;
    const safariIphoneUa =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

    try {
      // 1. UA de Safari iPhone con isStandalone() = false → debe devolver true
      // (incluso si navigator.standalone contradijera con true)
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: safariIphoneUa, standalone: true },
        writable: true,
        configurable: true,
      });
      vi.mocked(isStandalone).mockReturnValue(false);
      expect(isIosSafariNonStandalone()).toBe(true);

      // 2. UA de Safari iPhone con isStandalone() = true → debe devolver false
      // (incluso si navigator.standalone contradijera con false)
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: safariIphoneUa, standalone: false },
        writable: true,
        configurable: true,
      });
      vi.mocked(isStandalone).mockReturnValue(true);
      expect(isIosSafariNonStandalone()).toBe(false);
    } finally {
      Object.defineProperty(window, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it('DoD: IosInstallGuideSheet se monta en un Sheet con los 3 pasos, la advertencia y acción de cerrar', () => {
    const handleClose = vi.fn();
    render(<IosInstallGuideSheet open={true} onOpenChange={handleClose} />);

    // Verificar pasos mandatorios según Stitch T01
    expect(screen.getByText(/Tocá el botón Compartir/i)).toBeTruthy();
    expect(screen.getByText(/Elegí «Agregar a inicio»/i)).toBeTruthy();
    expect(screen.getByText(/Abrí cadeApp desde el ícono de tu pantalla/i)).toBeTruthy();

    // Advertencia de Chrome en iPhone
    expect(
      screen.getByText(/Si usás Chrome en iPhone, primero abrí este link en Safari/i)
    ).toBeTruthy();

    // Botón o acción de cerrar
    const closeBtn = screen.getByRole('button', { name: /Entendido|Cerrar/i });
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
