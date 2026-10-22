import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminNav } from './admin-nav';
import { logoutAction } from '@/features/auth';

const push = vi.fn();
const refresh = vi.fn();
let pathname = '/admin/applicants';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathname,
}));

vi.mock('@/features/auth', () => ({
  logoutAction: vi.fn(),
}));

describe('AdminNav (PR106-H10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = '/admin/applicants';
  });

  it('T-410: muestra «Viajes» entre Comercios e Incidentes y la marca activa en el detalle de un viaje', () => {
    pathname = '/admin/trips/00000000-0000-4000-8000-000000370001';
    render(<AdminNav />);

    const links = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/admin/') && link.textContent);
    const labels = links.map((link) => link.textContent);
    expect(labels.indexOf('Viajes')).toBe(labels.indexOf('Comercios') + 1);
    expect(labels.indexOf('Incidentes')).toBe(labels.indexOf('Viajes') + 1);

    const trips = screen.getByRole('link', { name: 'Viajes' });
    expect(trips.getAttribute('href')).toBe('/admin/trips');
    expect(trips.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Incidentes' }).getAttribute('aria-current')).toBeNull();
  });

  it('ejecuta logoutAction y redirige a /login al hacer click en Salir', async () => {
    vi.mocked(logoutAction).mockResolvedValue(undefined as never);

    render(<AdminNav />);

    const logoutButton = screen.getByRole('button', { name: /salir/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(logoutAction).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith('/login');
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});
