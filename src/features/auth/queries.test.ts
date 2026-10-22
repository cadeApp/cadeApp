import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getServerSession } from './queries';
import * as serverSupabase from '@/server/supabase/server';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-009 / H16: Queries de sesión y consumo asíncrono de createClient()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getServerSession invoca await createClient() y resuelve la sesión asíncronamente', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'usr-test-1', email: 'test@example.com' } },
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

    const mockGetAal = vi.fn().mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    });

    vi.mocked(serverSupabase.createClient).mockImplementation(async () => {
      // Simula retraso asíncrono con microtarea para verificar que se espera la promesa sin timer fijo
      await Promise.resolve();
      return {
        auth: {
          getUser: mockGetUser,
          mfa: {
            getAuthenticatorAssuranceLevel: mockGetAal,
          },
        },
        from: mockFrom,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>;
    });

    const session = await getServerSession();

    expect(serverSupabase.createClient).toHaveBeenCalledTimes(1);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('usr-test-1');
    expect(session?.role).toBe('merchant');
    expect(session?.aal).toBe('aal1');
    expect(session?.consentStatus).toBe('active');
  });

  it('getServerSession retorna null si no hay usuario autenticado', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: mockGetUser,
      },
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const session = await getServerSession();
    expect(serverSupabase.createClient).toHaveBeenCalledTimes(1);
    expect(session).toBeNull();
  });

  it('getServerSession retorna null si el perfil devuelve null o error (PR60-H01)', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'usr-test-1', email: 'test@example.com' } },
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

    const mockGetAal = vi.fn().mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: mockGetUser,
        mfa: {
          getAuthenticatorAssuranceLevel: mockGetAal,
        },
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const session = await getServerSession();
    expect(session).toBeNull();
  });

  it('getServerSession retorna null si consent_status es inválido o no existe (H06)', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'usr-test-1', email: 'test@example.com' } },
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant', consent_status: 'invalido' },
            error: null,
          }),
        }),
      }),
    });

    const mockGetAal = vi.fn().mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: mockGetUser,
        mfa: {
          getAuthenticatorAssuranceLevel: mockGetAal,
        },
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const session = await getServerSession();
    expect(session).toBeNull();
  });
});
