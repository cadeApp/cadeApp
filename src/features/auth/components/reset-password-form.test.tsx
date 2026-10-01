import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordForm } from './reset-password-form';
import { authCopy } from '../copy';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const updatePasswordAction = vi.fn();
vi.mock('../actions', () => ({
  updatePasswordAction: (input: unknown) => updatePasswordAction(input),
}));

describe('T-320: ResetPasswordForm — Formulario de cambio de contraseña', () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    updatePasswordAction.mockReset();
  });

  describe('Estado sin sesión (enlace no válido o expirado)', () => {
    it('sin sesión no muestra campos de contraseña y muestra mensaje con enlace a /forgot-password', () => {
      render(<ResetPasswordForm hasSession={false} />);

      expect(screen.queryByLabelText(/contraseña/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /guardar/i })).toBeNull();

      expect(screen.getByText(authCopy.resetPassword.invalidLinkTitle)).not.toBeNull();
      const link = screen.getByRole('link', { name: authCopy.resetPassword.requestNewLink });
      expect(link).not.toBeNull();
      expect(link.getAttribute('href')).toBe('/forgot-password');
    });
  });

  describe('Estado con sesión de recuperación', () => {
    it('con sesión muestra el formulario con campos de contraseña y confirmación', () => {
      render(<ResetPasswordForm hasSession={true} />);

      expect(
        screen.getByLabelText(authCopy.resetPassword.passwordLabel)
      ).not.toBeNull();
      expect(
        screen.getByLabelText(authCopy.resetPassword.passwordConfirmLabel)
      ).not.toBeNull();
      expect(
        screen.getByRole('button', { name: authCopy.resetPassword.submitButton })
      ).not.toBeNull();
    });

    it('valida que la contraseña tenga al menos 8 caracteres y que coincidan', async () => {
      render(<ResetPasswordForm hasSession={true} />);

      const pwdInput = screen.getByLabelText(authCopy.resetPassword.passwordLabel);
      const confirmInput = screen.getByLabelText(authCopy.resetPassword.passwordConfirmLabel);
      const submitBtn = screen.getByRole('button', { name: authCopy.resetPassword.submitButton });

      // Demasiado corta
      fireEvent.change(pwdInput, { target: { value: 'short' } });
      fireEvent.change(confirmInput, { target: { value: 'short' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(authCopy.resetPassword.errorLength)).not.toBeNull();
      });
      expect(updatePasswordAction).not.toHaveBeenCalled();

      // No coinciden
      fireEvent.change(pwdInput, { target: { value: 'passwordSegura1' } });
      fireEvent.change(confirmInput, { target: { value: 'passwordDiferente2' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(authCopy.resetPassword.errorMismatch)).not.toBeNull();
      });
      expect(updatePasswordAction).not.toHaveBeenCalled();
    });

    it('al enviar con éxito llama a updatePasswordAction y redirige a la ruta devuelta', async () => {
      updatePasswordAction.mockResolvedValue({
        ok: true,
        data: { redirectTo: '/merchant/dashboard' },
      });

      render(<ResetPasswordForm hasSession={true} />);

      const pwdInput = screen.getByLabelText(authCopy.resetPassword.passwordLabel);
      const confirmInput = screen.getByLabelText(authCopy.resetPassword.passwordConfirmLabel);
      const submitBtn = screen.getByRole('button', { name: authCopy.resetPassword.submitButton });

      fireEvent.change(pwdInput, { target: { value: 'nuevaPassword123' } });
      fireEvent.change(confirmInput, { target: { value: 'nuevaPassword123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(updatePasswordAction).toHaveBeenCalledWith({
          password: 'nuevaPassword123',
          confirmPassword: 'nuevaPassword123',
        });
      });

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/merchant/dashboard');
      });
    });
  });
});
