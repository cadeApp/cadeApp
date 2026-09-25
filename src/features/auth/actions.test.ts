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
              data: { role: 'merchant' },
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
  });
});
