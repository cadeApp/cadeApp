import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerSchema } from './schemas';
import {
  registerAction,
  loginAction,
  logoutAction,
  requestPasswordResetAction,
  updatePasswordAction,
} from './actions';
import { getRoleDefaultPath } from './guards';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('T-009: Auth actions y esquemas de registro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      },
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);
  });

  describe('Registro y validación de roles permitidos', () => {
    it('registerSchema acepta rol merchant y courier', () => {
      const merchantInput = {
        email: 'comercio@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      };
      const courierInput = {
        email: 'repartidor@test.com',
        password: 'password123',
        role: 'courier',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      };

      expect(registerSchema.safeParse(merchantInput).success).toBe(true);
      expect(registerSchema.safeParse(courierInput).success).toBe(true);
    });

    it('registerSchema rechaza rol admin y cualquier rol no permitido con error de validación', () => {
      const adminInput = {
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin',
      };
      const invalidRoleInput = {
        email: 'otro@test.com',
        password: 'password123',
        role: 'superadmin',
      };

      const adminParsed = registerSchema.safeParse(adminInput);
      expect(adminParsed.success).toBe(false);

      const invalidParsed = registerSchema.safeParse(invalidRoleInput);
      expect(invalidParsed.success).toBe(false);
    });

    it('registerAction registra correctamente un usuario con rol merchant', async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' }, session: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'comercio@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // T-318: el resultado público no incluye el id del usuario (anti-enumeración).
        expect(result.data).toStrictEqual({ role: 'merchant', redirectTo: '/merchant/onboarding' });
      }
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'comercio@test.com',
        password: 'password123',
        options: {
          data: expect.objectContaining({
            role: 'merchant',
          }),
        },
      });
    });

    it('registerAction registra correctamente un usuario con rol courier', async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-courier-1', email: 'courier@test.com' }, session: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'courier@test.com',
        password: 'password123',
        role: 'courier',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // T-318: el resultado público no incluye el id del usuario (anti-enumeración).
        expect(result.data).toStrictEqual({
          role: 'courier',
          redirectTo: '/courier/onboarding/identity',
        });
      }
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'courier@test.com',
        password: 'password123',
        options: {
          data: expect.objectContaining({
            role: 'courier',
          }),
        },
      });
    });

    it('registerAction rechaza rol admin con INVALID_SIGNUP_ROLE sin invocar signUp', async () => {
      const mockSignUp = vi.fn();
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_SIGNUP_ROLE');
      }
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('registerAction rechaza acceptTerms: false con VALIDATION_ERROR (PR60-H06)', async () => {
      const mockSignUp = vi.fn();
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'comercio@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: false,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('registerAction rechaza versión no vigente (0.9) de TOS con VALIDATION_ERROR sin invocar signUp (H05)', async () => {
      const mockSignUp = vi.fn();
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'comercio@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '0.9',
        acceptedPrivacyVersion: '1.0',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
      expect(mockSignUp).not.toHaveBeenCalled();
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('registerAction rechaza versión no vigente (0.9) de Privacidad con VALIDATION_ERROR sin invocar signUp (H05)', async () => {
      const mockSignUp = vi.fn();
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'repartidor@test.com',
        password: 'password123',
        role: 'courier',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '0.9',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
      expect(mockSignUp).not.toHaveBeenCalled();
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('registerAction invoca activate_account_consents y ejecuta cleanup deleteUser si la activación falla (H06 / CC-007)', async () => {
      const deleteUserSpy = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
      const rpcSpy = vi.fn().mockResolvedValue({ error: { message: 'Database failure on activate_account_consents' } });

      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        rpc: rpcSpy,
        auth: {
          admin: {
            deleteUser: deleteUserSpy,
          },
        },
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-fail-consent-1', email: 'merchant@test.com' }, session: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'merchant@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INTERNAL_ERROR');
      }
      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(rpcSpy).toHaveBeenCalledWith('activate_account_consents', {
        p_user_id: 'usr-fail-consent-1',
        p_tos_version: '1.0',
        p_privacy_version: '1.0',
      });
      expect(deleteUserSpy).toHaveBeenCalledWith('usr-fail-consent-1');
    });

    it('registerAction devuelve INTERNAL_ERROR y no lanza excepción si deleteUser devuelve { error } (H06 / CC-007)', async () => {
      const deleteUserSpy = vi.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('delete failed'),
      });
      const rpcSpy = vi.fn().mockResolvedValue({ error: { message: 'RPC failure' } });

      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        rpc: rpcSpy,
        auth: {
          admin: {
            deleteUser: deleteUserSpy,
          },
        },
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-fail-consent-2', email: 'merchant2@test.com' }, session: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'merchant2@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INTERNAL_ERROR');
      }
      expect(deleteUserSpy).toHaveBeenCalledWith('usr-fail-consent-2');
    });

    it('registerAction devuelve INTERNAL_ERROR y no lanza excepción si deleteUser rechaza con error de red (H06 / CC-007)', async () => {
      const deleteUserSpy = vi.fn().mockRejectedValue(new Error('network failure'));
      const rpcSpy = vi.fn().mockResolvedValue({ error: { message: 'RPC failure' } });

      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        rpc: rpcSpy,
        auth: {
          admin: {
            deleteUser: deleteUserSpy,
          },
        },
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-fail-consent-3', email: 'merchant3@test.com' }, session: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'merchant3@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INTERNAL_ERROR');
      }
      expect(deleteUserSpy).toHaveBeenCalledWith('usr-fail-consent-3');
    });

    it('registerAction jamás invoca deleteUser si activate_account_consents fue exitoso (H06 / CC-007)', async () => {
      const deleteUserSpy = vi.fn();
      const rpcSpy = vi.fn().mockResolvedValue({ data: { success: true }, error: null });

      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        rpc: rpcSpy,
        auth: {
          admin: {
            deleteUser: deleteUserSpy,
          },
        },
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-success-1', email: 'merchant@test.com' }, session: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'merchant@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });

      expect(result.ok).toBe(true);
      expect(rpcSpy).toHaveBeenCalledWith('activate_account_consents', {
        p_user_id: 'usr-success-1',
        p_tos_version: '1.0',
        p_privacy_version: '1.0',
      });
      expect(deleteUserSpy).not.toHaveBeenCalled();
    });
  });

  describe('T-318: motivo del rechazo de Supabase Auth en el registro', () => {
    const VALID_INPUT = {
      email: 'comercio@test.com',
      password: 'password123',
      role: 'merchant',
      acceptTerms: true,
      acceptedTermsVersion: '1.0',
      acceptedPrivacyVersion: '1.0',
    } as const;

    function mockSignUpResult(result: { data: unknown; error: unknown }) {
      const signUp = vi.fn().mockResolvedValue(result);
      const signOut = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: { signUp, signOut },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
      return { signUp, signOut };
    }

    it.each([
      ['weak_password', 'VALIDATION_ERROR'],
      ['email_address_invalid', 'VALIDATION_ERROR'],
      ['validation_failed', 'VALIDATION_ERROR'],
      ['over_email_send_rate_limit', 'RATE_LIMITED'],
      ['over_request_rate_limit', 'RATE_LIMITED'],
      ['unexpected_failure', 'INTERNAL_ERROR'],
      ['email_provider_disabled', 'INTERNAL_ERROR'],
      ['email_address_not_authorized', 'INTERNAL_ERROR'],
      ['captcha_failed', 'INTERNAL_ERROR'],
      ['hook_timeout', 'INTERNAL_ERROR'],
      ['hook_timeout_after_retry', 'INTERNAL_ERROR'],
      ['unknown_code', 'INTERNAL_ERROR'],
      [undefined, 'INTERNAL_ERROR'],
    ])('error %s → %s', async (code, expected) => {
      mockSignUpResult({
        data: { user: null, session: null },
        error: { code, message: 'detalle interno de Supabase' },
      });
      expect(await registerAction(VALID_INPUT)).toEqual({ ok: false, code: expected });
    });

    describe('anti-enumeración: toda señal de cuenta existente responde igual que un alta nueva', () => {
      // Con Confirm Email OFF, Supabase autentica el alta nueva: la acción tiene que terminar sin sesión.
      const NEW_USER_WITH_SESSION = {
        data: {
          user: { id: 'usr-new-real', identities: [{ id: 'identity-1' }] },
          session: { access_token: 'fresh-access', refresh_token: 'fresh-refresh' },
        },
        error: null,
      };
      // Con Confirm Email ON, el alta nueva llega sin sesión.
      const NEW_USER_WITHOUT_SESSION = {
        data: { user: { id: 'usr-new-real', identities: [{ id: 'identity-1' }] }, session: null },
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

      async function publicResult(
        signUpResult: { data: unknown; error: unknown },
        signOutResult: { error: unknown } = { error: null }
      ) {
        const { signOut } = mockSignUpResult(signUpResult);
        signOut.mockResolvedValue(signOutResult);
        const rpc = vi.mocked(adminSupabase.createAdminClient)().rpc;
        vi.mocked(rpc).mockClear();
        const result = await registerAction(VALID_INPUT);
        return { result, activations: vi.mocked(rpc).mock.calls.length, signOut };
      }

      it('el alta nueva con sesión devuelve éxito sin id, activa una vez y cierra la sesión local', async () => {
        const fresh = await publicResult(NEW_USER_WITH_SESSION);
        expect(fresh.result).toStrictEqual({
          ok: true,
          data: { role: 'merchant', redirectTo: '/merchant/onboarding' },
        });
        expect(JSON.stringify(fresh.result)).not.toMatch(/usr-new-real|fresh-access|fresh-refresh/);
        expect(fresh.activations).toBe(1);
        expect(fresh.signOut).toHaveBeenCalledTimes(1);
        expect(fresh.signOut).toHaveBeenCalledWith({ scope: 'local' });
      });

      it('el alta nueva sin sesión devuelve éxito, activa una vez y no llama signOut', async () => {
        const fresh = await publicResult(NEW_USER_WITHOUT_SESSION);
        expect(fresh.result).toStrictEqual({
          ok: true,
          data: { role: 'merchant', redirectTo: '/merchant/onboarding' },
        });
        expect(fresh.activations).toBe(1);
        expect(fresh.signOut).not.toHaveBeenCalled();
      });

      it.each(EXISTING_ACCOUNT_SIGNALS)(
        '%s → mismo resultado público que un alta nueva, sin activar consentimientos ni signOut',
        async (_signal, signUpResult) => {
          const fresh = await publicResult(NEW_USER_WITH_SESSION);
          const existing = await publicResult(signUpResult);

          expect(existing.result).toStrictEqual(fresh.result);
          expect(JSON.stringify(existing.result)).not.toMatch(/sanitized-id|usr-new-real/);
          expect(JSON.stringify(existing.result)).not.toMatch(ENUMERATING_TEXT);
          expect(existing.activations).toBe(0);
          expect(existing.signOut).not.toHaveBeenCalled();
        }
      );

      it('si no se puede cerrar la sesión del alta nueva, falla cerrado sin activar consentimientos', async () => {
        const failed = await publicResult(NEW_USER_WITH_SESSION, {
          error: new Error('signout failed'),
        });
        expect(failed.result).toStrictEqual({ ok: false, code: 'INTERNAL_ERROR' });
        expect(JSON.stringify(failed.result)).not.toContain('signout failed');
        expect(failed.activations).toBe(0);
      });
    });

    it('el rechazo del trigger por rol inválido sigue devolviendo INVALID_SIGNUP_ROLE', async () => {
      mockSignUpResult({
        data: { user: null, session: null },
        error: { code: 'unexpected_failure', message: 'Database error: INVALID_SIGNUP_ROLE' },
      });
      expect(await registerAction(VALID_INPUT)).toEqual({ ok: false, code: 'INVALID_SIGNUP_ROLE' });
    });
  });

  describe('Consumo asíncrono obligatorio de await createClient() en login y logout (H16)', () => {
    it('loginAction consume asíncronamente createClient() y autentica con signInWithPassword', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'usr-merchant-1', email: 'comercio@test.com' },
          session: { access_token: 'jwt' },
        },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'merchant', consent_status: 'active' },
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(serverSupabase.createClient).mockImplementation(async () => {
        await Promise.resolve();
        return {
          auth: {
            signInWithPassword: mockSignIn,
          },
          from: mockFrom,
        } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>;
      });

      const result = await loginAction({
        email: 'comercio@test.com',
        password: 'password123',
      });

      expect(serverSupabase.createClient).toHaveBeenCalledTimes(1);
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'comercio@test.com',
        password: 'password123',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.role).toBe('merchant');
        expect(result.data.redirectTo).toBe(getRoleDefaultPath('merchant'));
      }
    });

    it('loginAction redirige a regularización cuando consent_status es pending (H06)', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'usr-merchant-pending', email: 'pending@test.com' },
          session: { access_token: 'jwt' },
        },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'merchant', consent_status: 'pending' },
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signInWithPassword: mockSignIn,
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await loginAction({
        email: 'pending@test.com',
        password: 'password123',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.redirectTo).toBe('/login?consentRequired=1');
      }
    });

    it('loginAction rechaza con UNAUTHORIZED_ACTOR cuando profiles devuelve null o error (PR60-H01)', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'usr-courier-1', email: 'courier@test.com' },
          session: { access_token: 'jwt' },
        },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signInWithPassword: mockSignIn,
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await loginAction({
        email: 'courier@test.com',
        password: 'password123',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHORIZED_ACTOR');
      }
    });

    it('loginAction rechaza con UNAUTHORIZED_ACTOR cuando consent_status es inválido (H06)', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'usr-courier-1', email: 'courier@test.com' },
          session: { access_token: 'jwt' },
        },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'courier', consent_status: 'invalido' },
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signInWithPassword: mockSignIn,
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await loginAction({
        email: 'courier@test.com',
        password: 'password123',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHORIZED_ACTOR');
      }
    });

    it('logoutAction consume asíncronamente createClient() y llama a signOut()', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(serverSupabase.createClient).mockImplementation(async () => {
        await Promise.resolve();
        return {
          auth: {
            signOut: mockSignOut,
          },
        } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>;
      });

      const result = await logoutAction();

      expect(serverSupabase.createClient).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(true);
    });

    it('T-206: logoutAction purga las suscripciones del usuario en push_subscriptions al cerrar sesión', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockGetUser = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-push-logout-1' } },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: mockGetUser,
          signOut: mockSignOut,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      let deletedBeforeSignOut = false;
      mockDeleteEq.mockImplementation(async () => {
        expect(mockSignOut).not.toHaveBeenCalled();
        deletedBeforeSignOut = true;
        return { error: null };
      });

      const result = await logoutAction();

      expect(result.ok).toBe(true);
      expect(mockAdminFrom).toHaveBeenCalledWith('push_subscriptions');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteEq).toHaveBeenCalledWith('user_id', 'usr-push-logout-1');
      expect(deletedBeforeSignOut).toBe(true);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('T-206: logoutAction no falla ni purga suscripciones si no hay usuario autenticado', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockGetUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: mockGetUser,
          signOut: mockSignOut,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const mockDelete = vi.fn();
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const result = await logoutAction();

      expect(result.ok).toBe(true);
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('T-206 (PR118-H06): logoutAction ejecuta signOut y retorna ok si getUser rechaza', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockGetUser = vi.fn().mockRejectedValue(new Error('Network error on getUser'));

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: mockGetUser,
          signOut: mockSignOut,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const mockDelete = vi.fn();
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const result = await logoutAction();

      expect(result.ok).toBe(true);
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('T-206 (PR118-H06): logoutAction ejecuta signOut y retorna ok si delete de push_subscriptions rechaza', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockGetUser = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-push-logout-error' } },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: mockGetUser,
          signOut: mockSignOut,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const mockDeleteEq = vi.fn().mockRejectedValue(new Error('DB failure deleting subscriptions'));
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const result = await logoutAction();

      expect(result.ok).toBe(true);
      expect(mockDeleteEq).toHaveBeenCalledWith('user_id', 'usr-push-logout-error');
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('T-320: URLs de confirmación, recuperación y cambio de contraseña', () => {
    it('registerAction pasa emailRedirectTo configurado con NEXT_PUBLIC_APP_URL a /auth/confirm', async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'usr-new-reg', identities: [{ id: 'ident-1' }] },
          session: null,
        },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const input = {
        email: 'nuevo@comercio.com',
        password: 'passwordSegura123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      };

      const result = await registerAction(input);

      expect(result.ok).toBe(true);
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'nuevo@comercio.com',
        password: 'passwordSegura123',
        options: expect.objectContaining({
          emailRedirectTo: 'http://localhost:3000/auth/confirm',
        }),
      });
    });

    it('requestPasswordResetAction pasa redirectTo configurado con NEXT_PUBLIC_APP_URL a /auth/confirm?next=/reset-password', async () => {
      const mockResetPassword = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          resetPasswordForEmail: mockResetPassword,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await requestPasswordResetAction({ email: 'usuario@test.com' });

      expect(result.ok).toBe(true);
      expect(result).toEqual({ ok: true, data: { sent: true } });
      expect(mockResetPassword).toHaveBeenCalledWith('usuario@test.com', {
        redirectTo: 'http://localhost:3000/auth/confirm?next=/reset-password',
      });
    });

    describe('updatePasswordAction', () => {
      it('falla con VALIDATION_ERROR si la contraseña tiene menos de 8 caracteres o no coinciden', async () => {
        const shortRes = await updatePasswordAction({
          password: 'short',
          confirmPassword: 'short',
        });
        expect(shortRes).toEqual({ ok: false, code: 'VALIDATION_ERROR' });

        const mismatchRes = await updatePasswordAction({
          password: 'password123',
          confirmPassword: 'password456',
        });
        expect(mismatchRes).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      });

      it('mapea errores de Supabase Auth adecuadamente', async () => {
        const mockUpdateUser = vi.fn();
        vi.mocked(serverSupabase.createClient).mockResolvedValue({
          auth: {
            updateUser: mockUpdateUser,
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
          },
        } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

        // weak_password
        mockUpdateUser.mockResolvedValueOnce({
          data: { user: null },
          error: { code: 'weak_password', message: 'Password is too weak' },
        });
        const weakRes = await updatePasswordAction({
          password: 'password123',
          confirmPassword: 'password123',
        });
        expect(weakRes).toEqual({ ok: false, code: 'VALIDATION_ERROR' });

        // same_password
        mockUpdateUser.mockResolvedValueOnce({
          data: { user: null },
          error: { code: 'same_password', message: 'New password should be different from the old password' },
        });
        const sameRes = await updatePasswordAction({
          password: 'password123',
          confirmPassword: 'password123',
        });
        expect(sameRes).toEqual({ ok: false, code: 'VALIDATION_ERROR' });

        // over_request_rate_limit
        mockUpdateUser.mockResolvedValueOnce({
          data: { user: null },
          error: { code: 'over_request_rate_limit', message: 'Rate limit exceeded' },
        });
        const rateRes = await updatePasswordAction({
          password: 'password123',
          confirmPassword: 'password123',
        });
        expect(rateRes).toEqual({ ok: false, code: 'RATE_LIMITED' });

        // sin sesión
        mockUpdateUser.mockResolvedValueOnce({
          data: { user: null },
          error: { code: 'session_missing', message: 'Auth session missing' },
        });
        const noSessionRes = await updatePasswordAction({
          password: 'password123',
          confirmPassword: 'password123',
        });
        expect(noSessionRes).toEqual({ ok: false, code: 'UNAUTHENTICATED' });

        // error desconocido -> INTERNAL_ERROR
        mockUpdateUser.mockResolvedValueOnce({
          data: { user: null },
          error: { code: 'unknown_failure', message: 'Server exploded' },
        });
        const internalRes = await updatePasswordAction({
          password: 'password123',
          confirmPassword: 'password123',
        });
        expect(internalRes).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
      });

      it('en éxito actualiza la contraseña, cierra las demás sesiones con scope others y redirige según rol', async () => {
        const mockUpdateUser = vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-reset-success' } },
          error: null,
        });
        const mockSignOut = vi.fn().mockResolvedValue({ error: null });
        const mockGetUser = vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-reset-success' } },
          error: null,
        });
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'merchant', consent_status: 'active' },
                error: null,
              }),
            }),
          }),
        });

        vi.mocked(serverSupabase.createClient).mockResolvedValue({
          auth: {
            updateUser: mockUpdateUser,
            signOut: mockSignOut,
            getUser: mockGetUser,
          },
          from: mockFrom,
        } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

        const result = await updatePasswordAction({
          password: 'nuevaPasswordSegura123',
          confirmPassword: 'nuevaPasswordSegura123',
        });

        expect(mockUpdateUser).toHaveBeenCalledWith({
          password: 'nuevaPasswordSegura123',
        });
        expect(mockSignOut).toHaveBeenCalledWith({ scope: 'others' });
        expect(result).toEqual({
          ok: true,
          data: {
            redirectTo: '/merchant/dashboard',
          },
        });
      });
    });
  });
});

