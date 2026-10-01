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
const DEFINITIVE_SENDING_OR_EXISTENCE_TEXT =
  /te enviamos|enviamos un enlace|cuenta creada|ya existe|email registrado|cuenta existente|already/i;

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
  fireEvent.change(screen.getByLabelText(/nombre y apellido/i), {
    target: { value: 'Comercio Test' },
  });
  fireEvent.change(screen.getByLabelText(/teléfono/i), {
    target: { value: '3815551234' },
  });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'comercio@test.com' } });
  fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
    target: { value: 'una-clave-segura' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(
    screen.getByRole('button', { name: /crear cuenta/i }).closest('form') as HTMLFormElement
  );
  await waitFor(() => {
    expect(
      push.mock.calls.length > 0 ||
        screen.queryByRole('alert') !== null ||
        container.textContent?.includes('Revisá tu email')
    ).toBe(true);
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

describe('T-318 / T-322: el formulario no permite distinguir un email ya registrado y no navega antes de confirmar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: { success: true }, error: null });
    signOut.mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({
      rpc,
      auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
    });
  });

  it('el alta nueva no navega al onboarding, muestra estado neutral condicional "Revisá tu email" y cierra la sesión local', async () => {
    const fresh = await observeSubmit(NEW_USER);
    expect(fresh.observed.navigation).toStrictEqual([]);
    expect(fresh.observed.text).toMatch(/revisá tu email/i);
    expect(fresh.observed.text).toContain('Si pudimos procesar el registro, vas a recibir un email');
    expect(fresh.observed.text).not.toMatch(DEFINITIVE_SENDING_OR_EXISTENCE_TEXT);
    expect(fresh.observed.alert).toBeNull();
    expect(fresh.activations).toBe(1);
    expect(fresh.signOutCalls).toStrictEqual([[{ scope: 'local' }]]);
  });

  it.each(EXISTING_ACCOUNT_SIGNALS)(
    '%s → misma navegación neutral, texto condicional sin afirmar envío ni existencia, sin activar consentimientos ni signOut',
    async (_signal, signUpResult) => {
      const fresh = await observeSubmit(NEW_USER);
      const existing = await observeSubmit(signUpResult);

      expect(existing.observed).toStrictEqual(fresh.observed);
      expect(existing.observed.navigation).toStrictEqual([]);
      expect(existing.observed.text).toMatch(/revisá tu email/i);
      expect(existing.observed.text).toContain('Si pudimos procesar el registro, vas a recibir un email');
      expect(existing.observed.text).not.toMatch(DEFINITIVE_SENDING_OR_EXISTENCE_TEXT);
      expect(existing.observed.text).not.toMatch(/sanitized-id|usr-new-real/);
      expect(existing.activations).toBe(0);
      expect(existing.signOutCalls).toStrictEqual([]);
    }
  );
});
