import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('MfaForm (PR106-H03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof document !== 'undefined' && !document.elementFromPoint) {
      document.elementFromPoint = () => null;
    }
  });

  it('navega exclusivamente al redirectTo sanitizado por el servidor y no al input crudo', async () => {
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
});
