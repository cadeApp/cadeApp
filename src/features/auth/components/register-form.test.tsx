import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authCopy } from '../copy';
import { RegisterForm } from './register-form';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const registerAction = vi.fn();
vi.mock('../actions', () => ({
  registerAction: (input: unknown) => registerAction(input),
}));

function submitValidForm() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'comercio@test.com' } });
  fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
    target: { value: 'una-clave-segura' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(
    screen.getByRole('button', { name: /crear cuenta/i }).closest('form') as HTMLFormElement
  );
}

describe('T-009: mensajes de error del registro', () => {
  beforeEach(() => {
    registerAction.mockReset();
  });

  it.each([
    ['CONFLICT', authCopy.register.errorEmailTaken],
    ['RATE_LIMITED', authCopy.register.errorRateLimited],
    ['VALIDATION_ERROR', authCopy.register.errorGeneric],
    ['INTERNAL_ERROR', authCopy.register.errorUnexpected],
  ])('%s muestra su mensaje específico', async (code, message) => {
    registerAction.mockResolvedValue({ ok: false, code });
    render(<RegisterForm />);
    submitValidForm();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(message);
    });
  });

  it('los mensajes de cada motivo son distintos entre sí', () => {
    const messages = [
      authCopy.register.errorEmailTaken,
      authCopy.register.errorRateLimited,
      authCopy.register.errorGeneric,
      authCopy.register.errorUnexpected,
    ];
    expect(new Set(messages).size).toBe(messages.length);
  });
});
