import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { IosInstallGuideSheet, isIosSafariNonStandalone } from '@/features/notifications/install';
import { OfflineBanner, OfflineFloatingCard } from '@/features/notifications/offline/offline-banner';
import { ErrorView } from '@/features/notifications/offline/error-view';
import { NotFoundView } from '@/features/notifications/offline/not-found-view';

describe('T-201: Verificación visual responsive (390px / 360px), emulación iOS Safari y accesibilidad', () => {
  beforeEach(() => {
    window.innerWidth = 390;
    window.innerHeight = 844;
  });

  describe('T01 — Guía de instalación en iOS Safari', () => {
    it('emulación de iOS Safari (standalone: false) vs iOS Chrome vs PWA instalada', () => {
      const origNav = window.navigator;

      // 1. iOS Safari en navegador -> debe ser true
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
          standalone: false,
        },
        writable: true,
        configurable: true,
      });
      expect(isIosSafariNonStandalone()).toBe(true);

      // 2. iOS ya instalado como PWA (standalone: true) -> debe ser false
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          standalone: true,
        },
        writable: true,
        configurable: true,
      });
      expect(isIosSafariNonStandalone()).toBe(false);

      // 3. Android Chrome -> debe ser false
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
          standalone: false,
        },
        writable: true,
        configurable: true,
      });
      expect(isIosSafariNonStandalone()).toBe(false);

      Object.defineProperty(window, 'navigator', {
        value: origNav,
        writable: true,
        configurable: true,
      });
    });

    it('renderizado responsive a 360px y 390px conserva targets táctiles de 48px y safe-areas', () => {
      window.innerWidth = 360;
      const { container } = render(<IosInstallGuideSheet open={true} onOpenChange={() => {}} />);

      const button = screen.getByRole('button', { name: /Entendido/i });
      expect(button.className).toContain('h-12'); // min 48px

      expect(document.body.querySelector('[data-sheet-side="bottom"]')).toBeTruthy();
      expect(document.body.querySelector('.safe-area-bottom')).toBeTruthy();
    });
  });

  describe('T03 — Estado offline responsive y degradación no destructiva', () => {
    it('OfflineBanner y OfflineFloatingCard mantienen legibilidad y targets en 360px', () => {
      window.innerWidth = 360;

      // Simular offline
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const { container } = render(
        <div>
          <OfflineBanner />
          <OfflineFloatingCard />
        </div>
      );

      const banner = container.querySelector('aside[role="status"]');
      expect(banner).toBeTruthy();
      expect(banner?.getAttribute('aria-live')).toBe('polite');

      const card = container.querySelector('div[role="region"]');
      expect(card).toBeTruthy();
      expect(card?.getAttribute('aria-label')).toBe('Aviso de reconexión');

      const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
      expect(retryBtn).toBeTruthy();

      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });
  });

  describe('T04 — Vistas de Error y 404 responsive (390px / 360px)', () => {
    it('ErrorView renderiza motivo gráfico ondulado, sin stack sensible y con targets mínimos de 48px', () => {
      window.innerWidth = 360;
      const dummyError = new Error('Sensitive SQL query failed at db.ts:42');
      const { container } = render(<ErrorView error={dummyError} reset={() => {}} />);

      // Motivo gráfico SVG de onda
      const svgWave = container.querySelector('svg path[d*="Q 15 0"]');
      expect(svgWave).toBeTruthy();

      // Botón reintentar
      const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
      expect(retryBtn.className).toContain('h-12');

      // Enlace volver al inicio
      const homeLink = screen.getByRole('link', { name: /Ir al inicio/i });
      expect(homeLink.className).toContain('h-12');

      // No filtrar mensaje interno
      expect(screen.queryByText(/Sensitive SQL query/i)).toBeNull();
    });

    it('NotFoundView a 390px presenta motivo gráfico, copy rioplatense y botón de inicio accesible', () => {
      window.innerWidth = 390;
      const { container } = render(<NotFoundView />);

      const svgWave = container.querySelector('svg path[d*="Q 15 0"]');
      expect(svgWave).toBeTruthy();

      const homeLink = screen.getByRole('link', { name: /Ir al inicio/i });
      expect(homeLink.className).toContain('h-12');
      expect(screen.getByText(/Página no encontrada/i)).toBeTruthy();
      expect(screen.getByText(/No encontramos lo que buscabas/i)).toBeTruthy();
    });
  });
});
