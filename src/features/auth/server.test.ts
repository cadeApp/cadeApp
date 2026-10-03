// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { updateSession } from './server';
import * as ssr from '@supabase/ssr';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

describe('T-334: updateSession lee el onboarding con el cliente del usuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-test');
  });

  type Row = Record<string, unknown> | null;

  /** Cliente de usuario simulado que responde según la tabla, como lo haría PostgREST con RLS. */
  function mockUserClient(
    rows: { profiles: Row; merchants?: Row; couriers?: Row },
    failingTable?: 'merchants' | 'couriers'
  ) {
    const selects: Array<{ table: string; columns: string }> = [];
    const from = vi.fn((table: string) => ({
      select: vi.fn((columns: string) => {
        selects.push({ table, columns });
        const failing = table === failingTable;
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: failing ? null : (rows[table as keyof typeof rows] ?? null),
              error: failing ? { message: 'transient read error', code: '57014' } : null,
            }),
          })),
        };
      }),
    }));
    vi.mocked(ssr.createServerClient).mockImplementation(
      () =>
        ({
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'usr-nuevo', email: 'nuevo@test.com' } },
              error: null,
            }),
            mfa: {
              getAuthenticatorAssuranceLevel: vi
                .fn()
                .mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null }),
            },
          },
          from,
        }) as unknown as ReturnType<typeof ssr.createServerClient>
    );
    return { from, selects };
  }

  it('comercio recién registrado (business_name vacío) en /merchant/dashboard va a /merchant/onboarding', async () => {
    const { selects } = mockUserClient({
      profiles: { role: 'merchant', consent_status: 'active' },
      merchants: { business_name: '' },
    });

    const response = await updateSession(new NextRequest('http://localhost:3000/merchant/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/merchant/onboarding');
    expect(selects).toContainEqual({ table: 'merchants', columns: 'business_name' });
  });

  it('repartidor recién registrado (vehicle_type null) en /courier/feed va a /courier/onboarding/identity', async () => {
    const { selects } = mockUserClient({
      profiles: { role: 'courier', consent_status: 'active' },
      couriers: { vehicle_type: null },
    });

    const response = await updateSession(new NextRequest('http://localhost:3000/courier/feed'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/courier/onboarding/identity'
    );
    expect(selects).toContainEqual({ table: 'couriers', columns: 'vehicle_type' });
  });

  it('repartidor incompleto puede abrir su onboarding sin redirección', async () => {
    mockUserClient({
      profiles: { role: 'courier', consent_status: 'active' },
      couriers: { vehicle_type: null },
    });

    const response = await updateSession(
      new NextRequest('http://localhost:3000/courier/onboarding/identity')
    );

    expect(response.status).toBe(200);
  });

  it('con onboarding completo no redirige', async () => {
    mockUserClient({
      profiles: { role: 'merchant', consent_status: 'active' },
      merchants: { business_name: 'Panadería Centro' },
    });
    const merchant = await updateSession(new NextRequest('http://localhost:3000/merchant/dashboard'));
    expect(merchant.status).toBe(200);

    mockUserClient({
      profiles: { role: 'courier', consent_status: 'active' },
      couriers: { vehicle_type: 'moto' },
    });
    const courier = await updateSession(new NextRequest('http://localhost:3000/courier/feed'));
    expect(courier.status).toBe(200);
  });

  it('CC-007 sigue primero: con consentimiento pendiente no se consulta el onboarding', async () => {
    const { selects } = mockUserClient({
      profiles: { role: 'merchant', consent_status: 'pending' },
      merchants: { business_name: '' },
    });

    const response = await updateSession(new NextRequest('http://localhost:3000/merchant/dashboard'));

    expect(response.headers.get('location')).toContain('/login?consentRequired=1');
    expect(selects.map((s) => s.table)).not.toContain('merchants');
  });

  it.each([
    ['merchant', 'merchants', '/merchant/dashboard'],
    ['courier', 'couriers', '/courier/feed'],
  ] as const)(
    'D02: si la lectura del marcador de %s falla, no fuerza el onboarding (fail-open de navegación)',
    async (role, table, path) => {
      const { selects } = mockUserClient(
        { profiles: { role, consent_status: 'active' } },
        table
      );

      const response = await updateSession(new NextRequest(`http://localhost:3000${path}`));

      expect(selects.map((s) => s.table)).toContain(table);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    }
  );

  it('no usa service role: server.ts no importa el cliente admin', () => {
    const source = readFileSync(resolve(__dirname, 'server.ts'), 'utf8');
    expect(source).not.toMatch(/server\/supabase\/admin|createAdminClient|SERVICE_ROLE/);
  });
});
