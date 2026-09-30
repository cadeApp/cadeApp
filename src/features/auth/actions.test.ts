import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerSchema } from './schemas';
import { registerAction, loginAction, logoutAction } from './actions';
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
        expect(result.data.role).toBe('merchant');
        expect(result.data.userId).toBe('usr-merchant-1');
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
        expect(result.data.role).toBe('courier');
        expect(result.data.userId).toBe('usr-courier-1');
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

  describe('Registro: motivo del rechazo de Supabase Auth', () => {
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
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: { signUp },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
      return signUp;
    }

    it.each(['user_already_exists', 'email_exists'])(
      'error %s → CONFLICT (email ya registrado)',
      async (code) => {
        mockSignUpResult({ data: { user: null, session: null }, error: { code, message: 'x' } });
        expect(await registerAction(VALID_INPUT)).toEqual({ ok: false, code: 'CONFLICT' });
      }
    );

    it('usuario ya registrado con confirmación de email (identities vacío) → CONFLICT sin activar consentimientos', async () => {
      mockSignUpResult({
        data: { user: { id: 'usr-fake', identities: [] }, session: null },
        error: null,
      });
      const rpc = vi.mocked(adminSupabase.createAdminClient)().rpc;
      expect(await registerAction(VALID_INPUT)).toEqual({ ok: false, code: 'CONFLICT' });
      expect(rpc).not.toHaveBeenCalled();
    });

    it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])(
      'error %s → RATE_LIMITED',
      async (code) => {
        mockSignUpResult({ data: { user: null, session: null }, error: { code, message: 'x' } });
        expect(await registerAction(VALID_INPUT)).toEqual({ ok: false, code: 'RATE_LIMITED' });
      }
    );

    it.each(['weak_password', 'email_address_invalid', undefined])(
      'error %s → VALIDATION_ERROR',
      async (code) => {
        mockSignUpResult({ data: { user: null, session: null }, error: { code, message: 'x' } });
        expect(await registerAction(VALID_INPUT)).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      }
    );
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
});

