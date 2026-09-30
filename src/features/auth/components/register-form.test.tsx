import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_DOMAIN_ERROR_CODES } from '@/domain/errors';
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

async function alertText(): Promise<string> {
  const alert = await screen.findByRole('alert');
  return alert.textContent ?? '';
}

const ENUMERATING_TEXT = /ya existe|email registrado|cuenta existente/i;

describe('T-318: mensajes de error del registro', () => {
  beforeEach(() => {
    registerAction.mockReset();
  });

  it.each([
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
      authCopy.register.errorRateLimited,
      authCopy.register.errorGeneric,
      authCopy.register.errorUnexpected,
    ];
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('el mensaje de datos no aceptados orienta a quien ya tiene cuenta sin afirmar que exista', async () => {
    registerAction.mockResolvedValue({ ok: false, code: 'VALIDATION_ERROR' });
    render(<RegisterForm />);
    submitValidForm();
    const text = await alertText();
    expect(text).toMatch(/ingresar/i);
    expect(text).toMatch(/recuperar tu contraseña/i);
    expect(text).not.toMatch(ENUMERATING_TEXT);
  });

  it.each(ALL_DOMAIN_ERROR_CODES)(
    'ningún código (%s) muestra un texto que confirme que el email ya tiene cuenta',
    async (code) => {
      registerAction.mockResolvedValue({ ok: false, code });
      render(<RegisterForm />);
      submitValidForm();
      expect(await alertText()).not.toMatch(ENUMERATING_TEXT);
    }
  );

  it('si el Server Action rechaza, muestra el problema temporal sin el detalle del error', async () => {
    registerAction.mockRejectedValueOnce(new Error('sentinel'));
    render(<RegisterForm />);
    submitValidForm();
    const text = await alertText();
    expect(text).toContain(authCopy.register.errorUnexpected);
    expect(text).not.toContain('sentinel');
  });
});
