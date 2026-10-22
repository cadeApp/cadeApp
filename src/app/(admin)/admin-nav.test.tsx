import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminNav } from './admin-nav';
import { logoutAction } from '@/features/auth';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => '/admin/applicants',
}));

vi.mock('@/features/auth', () => ({
  logoutAction: vi.fn(),
}));

describe('AdminNav (PR106-H10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
