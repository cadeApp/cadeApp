import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from './register-form';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));
// El componente no importa código de servidor: se mockean los clientes que usa el `registerAction` real.
const { createClient, createAdminClient, rpc, signOut } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/server/supabase/server', () => ({ createClient }));
vi.mock('@/server/supabase/admin', () => ({ createAdminClient }));
vi.mock('@/lib/env.public', () => ({
  publicEnv: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-test',
  },
}));

// Con Confirm Email OFF, Supabase autentica el alta nueva: la acción tiene que terminar sin sesión.
const NEW_USER = {
  data: {
    user: { id: 'usr-new-real', identities: [{ id: 'identity-1' }] },
    session: { access_token: 'fresh-access', refresh_token: 'fresh-refresh' },
  },
  error: null,
};
const EXISTING_ACCOUNT_SIGNALS = [
  [
    'respuesta sanitizada identities: []',
    { data: { user: { id: 'sanitized-id', identities: [] }, session: null }, error: null },
  ],
  [
    'user_already_exists',
    {
      data: { user: null, session: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    },
  ],
  [
    'email_exists',
    {
      data: { user: null, session: null },
      error: { code: 'email_exists', message: 'Email address already exists' },
    },
  ],
] as const;
const ENUMERATING_TEXT = /ya existe|email registrado|cuenta existente|already/i;

/** Envía el formulario con el `registerAction` real y devuelve todo lo que el usuario puede observar. */
async function observeSubmit(signUpResult: { data: unknown; error: unknown }) {
  push.mockClear();
  refresh.mockClear();
  rpc.mockClear();
  signOut.mockClear();
  createClient.mockResolvedValue({
    auth: { signUp: vi.fn().mockResolvedValue(signUpResult), signOut },
  });

  const { container, unmount } = render(<RegisterForm />);
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'comercio@test.com' } });
  fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
    target: { value: 'una-clave-segura' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(
    screen.getByRole('button', { name: /crear cuenta/i }).closest('form') as HTMLFormElement
  );
  await waitFor(() => {
    expect(push.mock.calls.length > 0 || screen.queryByRole('alert') !== null).toBe(true);
  });

  const observed = {
    navigation: push.mock.calls,
    refreshes: refresh.mock.calls.length,
    alert: screen.queryByRole('alert')?.textContent ?? null,
    text: container.textContent,
  };
  const activations = rpc.mock.calls.length;
  const signOutCalls = signOut.mock.calls;
  unmount();
  return { observed, activations, signOutCalls };
}

describe('T-318: el formulario no permite distinguir un email ya registrado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: { success: true }, error: null });
    signOut.mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({
      rpc,
      auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
    });
  });

  it('el alta nueva navega al onboarding sin mostrar error y cierra la sesión local', async () => {
    const fresh = await observeSubmit(NEW_USER);
    expect(fresh.observed.navigation).toStrictEqual([['/merchant/onboarding']]);
    expect(fresh.observed.alert).toBeNull();
    expect(fresh.activations).toBe(1);
    expect(fresh.signOutCalls).toStrictEqual([[{ scope: 'local' }]]);
  });

  it.each(EXISTING_ACCOUNT_SIGNALS)(
    '%s → misma navegación, mismo texto, sin activar consentimientos ni signOut',
    async (_signal, signUpResult) => {
      const fresh = await observeSubmit(NEW_USER);
      const existing = await observeSubmit(signUpResult);

      expect(existing.observed).toStrictEqual(fresh.observed);
      expect(existing.observed.text).not.toMatch(ENUMERATING_TEXT);
      expect(existing.observed.text).not.toMatch(/sanitized-id|usr-new-real/);
      expect(existing.activations).toBe(0);
      expect(existing.signOutCalls).toStrictEqual([]);
    }
  );
});
