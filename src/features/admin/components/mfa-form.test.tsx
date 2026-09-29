import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MfaForm } from './mfa-form';
import { verifyAdminMfaAction } from '../actions';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock('../actions', () => ({
  verifyAdminMfaAction: vi.fn(),
}));

describe('MfaForm (PR106-H03, PR106-H13, PR106-H15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof document !== 'undefined' && !document.elementFromPoint) {
      document.elementFromPoint = () => null;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navega exclusivamente al redirectTo sanitizado por el servidor y no al input crudo (PR106-H03)', async () => {
    vi.mocked(verifyAdminMfaAction).mockResolvedValue({
      ok: true,
      data: {
        success: true,
        redirectTo: '/admin/applicants',
      },
    });

    render(<MfaForm redirectTo="javascript:alert(1)" />);

    const input = document.getElementById('totp-code') ?? screen.getByLabelText(/código de seguridad/i);
    fireEvent.change(input, { target: { value: '123456' } });

    const submitButton = screen.getByRole('button', { name: /verificar código/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(verifyAdminMfaAction).toHaveBeenCalledWith({
        code: '123456',
        redirectTo: 'javascript:alert(1)',
      });
      expect(push).toHaveBeenCalledWith('/admin/applicants');
      expect(push).not.toHaveBeenCalledWith('javascript:alert(1)');
      expect(refresh).toHaveBeenCalled();
    });
  });

  describe('Countdown TOTP de 30 segundos derivado del reloj (PR106-H15)', () => {
    it('muestra el tiempo restante correcto y se actualiza al avanzar el reloj', () => {
      // 1700000020000 ms -> Math.floor(1700000020000 / 1000) = 1700000020
      // 1700000020 % 30 = 10 -> remaining = 30 - 10 = 20s
      const baseTime = 1700000020000;
      vi.useFakeTimers();
      vi.setSystemTime(baseTime);

      render(<MfaForm />);

      expect(screen.getByText('Expira en 00:20')).toBeDefined();

      // Avanzamos 1 segundo
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('Expira en 00:19')).toBeDefined();

      // Avanzamos 19 segundos más (cruza al nuevo ciclo de 30s)
      act(() => {
        vi.advanceTimersByTime(19000);
      });
      expect(screen.getByText('Expira en 00:30')).toBeDefined();

      vi.useRealTimers();
    });
  });

  describe('Validación RHF + Zod (PR106-H13)', () => {
    it('bloquea submit si el código tiene menos de 6 dígitos numéricos', async () => {
      render(<MfaForm />);
      const submitButton = screen.getByRole('button', { name: /verificar código/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(verifyAdminMfaAction).not.toHaveBeenCalled();
      });
    });
  });
});
