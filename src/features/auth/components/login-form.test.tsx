import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const loginAction = vi.fn();
vi.mock('../actions', () => ({
  loginAction: (input: unknown) => loginAction(input),
}));

function submit(initialRedirectTo?: string) {
  render(<LoginForm initialRedirectTo={initialRedirectTo} />);
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'usuario@test.com' } });
  fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'una-clave' } });
  fireEvent.submit(
    screen.getByRole('button', { name: /ingresar/i }).closest('form') as HTMLFormElement
  );
}

describe('T-317 / PR139-H14: destino del formulario de login', () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    loginAction.mockReset();
  });

  it('admin sin redirectTo → navega al MFA hacia /admin/applicants, nunca a /', async () => {
    loginAction.mockResolvedValue({
      ok: true,
      data: { userId: 'adm-1', role: 'admin', consentStatus: 'active', redirectTo: '/ignored' },
    });
    submit();
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/login/mfa?redirectTo=%2Fadmin%2Fapplicants');
    expect(push).not.toHaveBeenCalledWith('/');
  });

  it.each([
    ['merchant', '/merchant/dashboard'],
    ['courier', '/courier/feed'],
  ])('%s sin redirectTo conserva su destino (%s)', async (role, expected) => {
    loginAction.mockResolvedValue({
      ok: true,
      data: { userId: 'usr-1', role, consentStatus: 'active', redirectTo: '/ignored' },
    });
    submit();
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(expected);
  });

  it('admin con redirectTo hostil → sigue saneado hacia el MFA', async () => {
    loginAction.mockResolvedValue({
      ok: true,
      data: { userId: 'adm-1', role: 'admin', consentStatus: 'active', redirectTo: '/ignored' },
    });
    submit('https://evil.com/phish');
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/login/mfa?redirectTo=%2Fadmin%2Fapplicants');
  });
});
