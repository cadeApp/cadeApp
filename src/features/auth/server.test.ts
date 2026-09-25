// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { updateSession } from './server';
import * as ssr from '@supabase/ssr';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

describe('T-009 / PR60-H03: server.ts updateSession y preservación de cookies rotadas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-test');
  });

  it('updateSession preserva cookies rotadas cuando la guarda emite una redirección', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/merchant/dashboard');

    const rotatedCookie = {
      name: 'sb-refresh-token',
      value: 'new-rotated-token-123',
      options: { path: '/', httpOnly: true },
    };

    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'usr-courier-1', email: 'courier@test.com' } },
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'courier', consent_status: 'active' },
            error: null,
          }),
        }),
      }),
    });

    const mockGetAal = vi.fn().mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    });

    vi.mocked(ssr.createServerClient).mockImplementation((_url, _key, options) => {
      // Simula que @supabase/ssr rota las cookies durante getUser
      options.cookies.setAll([rotatedCookie]);
      return {
        auth: {
          getUser: mockGetUser,
          mfa: {
            getAuthenticatorAssuranceLevel: mockGetAal,
          },
        },
        from: mockFrom,
      } as unknown as ReturnType<typeof ssr.createServerClient>;
    });

    const response = await updateSession(mockRequest);

    // Courier intentando entrar a /merchant/dashboard debe ser redirigido a /courier/feed
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/courier/feed');

    // PR60-H03: Las cookies rotadas DEBEN estar en la respuesta de redirección
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain('sb-refresh-token=new-rotated-token-123');
  });

  it('updateSession bloquea a usuarios con consent_status = pending redirigiendo a regularizacion (CC-007)', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/merchant/dashboard');

    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'usr-merchant-pending', email: 'pending@test.com' } },
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

    const mockGetAal = vi.fn().mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    });

    vi.mocked(ssr.createServerClient).mockImplementation(() => {
      return {
        auth: {
          getUser: mockGetUser,
          mfa: { getAuthenticatorAssuranceLevel: mockGetAal },
        },
        from: mockFrom,
      } as unknown as ReturnType<typeof ssr.createServerClient>;
    });

    const response = await updateSession(mockRequest);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?consentRequired=1');
  });

  it('updateSession bloquea a usuarios con consent_status = reconsent_required (CC-007)', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/courier/feed');

    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'usr-courier-reconsent', email: 'reconsent@test.com' } },
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'courier', consent_status: 'reconsent_required' },
            error: null,
          }),
        }),
      }),
    });

    const mockGetAal = vi.fn().mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    });

    vi.mocked(ssr.createServerClient).mockImplementation(() => {
      return {
        auth: {
          getUser: mockGetUser,
          mfa: { getAuthenticatorAssuranceLevel: mockGetAal },
        },
        from: mockFrom,
      } as unknown as ReturnType<typeof ssr.createServerClient>;
    });

    const response = await updateSession(mockRequest);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?consentRequired=1');
  });

  it('updateSession degrada a null si profiles devuelve null o error (PR60-H01)', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/merchant/dashboard');

    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'usr-corrupt', email: 'corrupt@test.com' } },
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error' },
          }),
        }),
      }),
    });

    const mockGetAal = vi.fn().mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    });

    vi.mocked(ssr.createServerClient).mockImplementation((_url, _key, _options) => {
      return {
        auth: {
          getUser: mockGetUser,
          mfa: {
            getAuthenticatorAssuranceLevel: mockGetAal,
          },
        },
        from: mockFrom,
      } as unknown as ReturnType<typeof ssr.createServerClient>;
    });

    const response = await updateSession(mockRequest);
    // Sin perfil válido, la sesión debe ser null y redirigir a /login (no escalar a merchant)
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('updateSession permite acceso a rutas públicas sin sesión', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/login');
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    vi.mocked(ssr.createServerClient).mockImplementation((_url, _key, _options) => {
      return {
        auth: {
          getUser: mockGetUser,
        },
      } as unknown as ReturnType<typeof ssr.createServerClient>;
    });
    const response = await updateSession(mockRequest);
    expect(response.status).toBe(200);
  });
});
