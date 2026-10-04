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

describe('T-317 / T-334: destino del formulario de login', () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    loginAction.mockReset();
  });

  it('usa exactamente el redirectTo saneado por loginAction para admin', async () => {
    loginAction.mockResolvedValue({
      ok: true,
      data: {
        userId: 'adm-1',
        role: 'admin',
        consentStatus: 'active',
        redirectTo: '/login/mfa?redirectTo=%2Fadmin%2Fapplicants',
      },
    });

    submit();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/login/mfa?redirectTo=%2Fadmin%2Fapplicants');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['merchant', '/merchant/onboarding'],
    ['courier', '/courier/onboarding/identity'],
  ])(
    'T-334: %s incompleto navega al onboarding devuelto por el servidor (%s)',
    async (role, redirectTo) => {
      loginAction.mockResolvedValue({
        ok: true,
        data: { userId: 'usr-1', role, consentStatus: 'active', redirectTo },
      });

      submit();

      await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
      expect(push).toHaveBeenCalledWith(redirectTo);
      expect(refresh).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ['merchant', '/merchant/dashboard'],
    ['courier', '/courier/feed'],
  ])('%s completo conserva el destino devuelto por loginAction (%s)', async (role, redirectTo) => {
    loginAction.mockResolvedValue({
      ok: true,
      data: { userId: 'usr-1', role, consentStatus: 'active', redirectTo },
    });

    submit();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(redirectTo);
  });

  it('un redirectTo hostil se envía al Server Action pero el cliente solo usa el destino saneado que vuelve', async () => {
    loginAction.mockResolvedValue({
      ok: true,
      data: {
        userId: 'adm-1',
        role: 'admin',
        consentStatus: 'active',
        redirectTo: '/login/mfa?redirectTo=%2Fadmin%2Fapplicants',
      },
    });

    submit('https://evil.com/phish');

    await waitFor(() => expect(loginAction).toHaveBeenCalledTimes(1));
    expect(loginAction).toHaveBeenCalledWith({
      email: 'usuario@test.com',
      password: 'una-clave',
      redirectTo: 'https://evil.com/phish',
    });
    expect(push).toHaveBeenCalledWith('/login/mfa?redirectTo=%2Fadmin%2Fapplicants');
    expect(push).not.toHaveBeenCalledWith('https://evil.com/phish');
  });
});
