import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as standaloneModule from './is-standalone';
import { StandaloneBackLink } from './standalone-back-link';
import { StandaloneRedirect } from './standalone-redirect';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

describe('T-338 DoD: Componentes de navegación standalone vs navegador común', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockReplace.mockReset();
  });

  describe('1. Redirección en modo instalado (StandaloneRedirect)', () => {
    it('en navegador común (isStandalone = false) renderiza el contenido y no redirige', () => {
      vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(false);

      render(
        <StandaloneRedirect to="/login">
          <div>Contenido de la landing pública</div>
        </StandaloneRedirect>
      );

      expect(screen.getByText('Contenido de la landing pública')).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('en modo instalado (isStandalone = true) reemplaza la URL por /login y no renderiza el contenido', () => {
      vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(true);

      render(
        <StandaloneRedirect to="/login">
          <div>Contenido de la landing pública</div>
        </StandaloneRedirect>
      );

      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.queryByText('Contenido de la landing pública')).toBeNull();
    });
  });

  describe('2. Control de retorno en login (StandaloneBackLink standaloneMode="hide")', () => {
    it('en navegador común renderiza enlace hacia el inicio /', () => {
      vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(false);

      render(
        <StandaloneBackLink href="/" standaloneMode="hide" aria-label="Volver al inicio">
          <span>Volver</span>
        </StandaloneBackLink>
      );

      const link = screen.getByRole('link', { name: /Volver al inicio/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/');
    });

    it('en modo instalado se oculta (no se renderiza el enlace)', () => {
      vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(true);

      render(
        <StandaloneBackLink href="/" standaloneMode="hide" aria-label="Volver al inicio">
          <span>Volver</span>
        </StandaloneBackLink>
      );

      expect(screen.queryByRole('link')).toBeNull();
    });
  });

  describe('3. Control de retorno en register/legal (StandaloneBackLink standaloneMode="login")', () => {
    it('en navegador común conserva el destino / hacia la landing', () => {
      vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(false);

      render(
        <StandaloneBackLink href="/" standaloneMode="login" aria-label="Volver al inicio">
          <span>Volver</span>
        </StandaloneBackLink>
      );

      const link = screen.getByRole('link', { name: /Volver al inicio/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/');
    });

    it('en modo instalado cambia el destino a /login para no mostrar la landing', () => {
      vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(true);

      render(
        <StandaloneBackLink href="/" standaloneMode="login" aria-label="Volver al inicio">
          <span>Volver</span>
        </StandaloneBackLink>
      );

      const link = screen.getByRole('link', { name: /Volver al inicio/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/login');
    });
  });

  describe('4. Consumidores reales de navegación y guards', { timeout: 15000 }, () => {
    describe('HomePage (src/app/page.tsx)', () => {
      it('en navegador común (isStandalone = false) muestra el heading de landing', async () => {
        vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(false);

        const { default: HomePage } = await import('@/app/page');
        render(<HomePage />);

        expect(
          screen.getByRole('heading', { name: /Tu envío, al precio que elijas/i })
        ).toBeTruthy();
        expect(mockReplace).not.toHaveBeenCalled();
      });

      it('en modo instalado (isStandalone = true) termina usando el guard que deriva a /login y no deja contenido visible', async () => {
        vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(true);

        const { default: HomePage } = await import('@/app/page');
        render(<HomePage />);

        expect(mockReplace).toHaveBeenCalledWith('/login');
        expect(
          screen.queryByRole('heading', { name: /Tu envío, al precio que elijas/i })
        ).toBeNull();
      });
    });

    describe('LoginPage (src/app/(public)/login/page.tsx)', () => {
      it('en navegador común conserva "Volver al inicio" hacia /', async () => {
        vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(false);

        const { default: LoginPage } = await import('@/app/(public)/login/page');
        const pageJsx = await LoginPage({ searchParams: Promise.resolve({}) });
        render(pageJsx);

        const backLink = screen.getByRole('link', { name: /Volver al inicio/i });
        expect(backLink).toBeTruthy();
        expect(backLink.getAttribute('href')).toBe('/');
      });

      it('en modo instalado no renderiza ese enlace', async () => {
        vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(true);

        const { default: LoginPage } = await import('@/app/(public)/login/page');
        const pageJsx = await LoginPage({ searchParams: Promise.resolve({}) });
        render(pageJsx);

        expect(screen.queryByRole('link', { name: /Volver al inicio/i })).toBeNull();
      });
    });

    describe('RegisterPage (src/app/(public)/register/page.tsx)', () => {
      it('en navegador común conserva /', async () => {
        vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(false);

        const { default: RegisterPage } = await import('@/app/(public)/register/page');
        const pageJsx = await RegisterPage({ searchParams: Promise.resolve({}) });
        render(pageJsx);

        const backLink = screen.getByRole('link', { name: /Volver al inicio/i });
        expect(backLink).toBeTruthy();
        expect(backLink.getAttribute('href')).toBe('/');
      });

      it('en modo instalado cambia ese control a /login', async () => {
        vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(true);

        const { default: RegisterPage } = await import('@/app/(public)/register/page');
        const pageJsx = await RegisterPage({ searchParams: Promise.resolve({}) });
        render(pageJsx);

        const backLink = screen.getByRole('link', { name: /Volver al inicio/i });
        expect(backLink).toBeTruthy();
        expect(backLink.getAttribute('href')).toBe('/login');
      });
    });

    describe('LegalIndexPage (src/app/(public)/legal/page.tsx)', () => {
      it('en navegador común conserva /', async () => {
        vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(false);

        const { default: LegalIndexPage } = await import('@/app/(public)/legal/page');
        render(<LegalIndexPage />);

        const backLink = screen.getByRole('link', { name: /Volver al inicio/i });
        expect(backLink).toBeTruthy();
        expect(backLink.getAttribute('href')).toBe('/');
      });

      it('en modo instalado cambia ese control a /login', async () => {
        vi.spyOn(standaloneModule, 'isStandalone').mockReturnValue(true);

        const { default: LegalIndexPage } = await import('@/app/(public)/legal/page');
        render(<LegalIndexPage />);

        const backLink = screen.getByRole('link', { name: /Volver al inicio/i });
        expect(backLink).toBeTruthy();
        expect(backLink.getAttribute('href')).toBe('/login');
      });
    });
  });
});
