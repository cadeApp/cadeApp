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
});
