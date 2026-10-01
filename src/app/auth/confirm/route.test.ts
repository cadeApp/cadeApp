// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { createClient } from '@/server/supabase/server';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-320: GET /auth/confirm — Enlaces de confirmación de Auth y recuperación', () => {
  let mockExchangeCodeForSession: ReturnType<typeof vi.fn>;
  let mockVerifyOtp: ReturnType<typeof vi.fn>;
  let mockGetUser: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExchangeCodeForSession = vi.fn().mockResolvedValue({
      data: {
        session: { access_token: 'fake-access-token' },
        user: { id: 'usr-123' },
      },
      error: null,
    });

    mockVerifyOtp = vi.fn().mockResolvedValue({
      data: {
        session: { access_token: 'fake-access-token' },
        user: { id: 'usr-123' },
      },
      error: null,
    });

    mockGetUser = vi.fn().mockResolvedValue({
      data: {
        user: { id: 'usr-123', email: 'test@example.com' },
      },
      error: null,
    });

    mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant', consent_status: 'active' },
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        verifyOtp: mockVerifyOtp,
        getUser: mockGetUser,
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  describe('Intercambio con code (flujo PKCE)', () => {
    it('code válido de registro merchant redirige a la ruta por defecto del rol', async () => {
      const request = new NextRequest('http://localhost:3000/auth/confirm?code=pkce-valid-code');
      const response = await GET(request);

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-valid-code');
      expect(response.status).toBe(303);
      const location = response.headers.get('location');
      expect(location).toBe('http://localhost:3000/merchant/dashboard');
    });

    it('code válido de registro courier redirige a /courier/feed', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'courier', consent_status: 'active' },
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/auth/confirm?code=pkce-courier-code');
      const response = await GET(request);

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-courier-code');
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('http://localhost:3000/courier/feed');
    });

    it('code con next=/reset-password redirige a /reset-password', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?code=pkce-recovery-code&next=/reset-password'
      );
      const response = await GET(request);

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-recovery-code');
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('http://localhost:3000/reset-password');
    });
  });

  describe('Verificación con token_hash y type', () => {
    it('token_hash con type=signup válido intercambia y redirige por rol', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?token_hash=th_signup_123&type=signup'
      );
      const response = await GET(request);

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'th_signup_123',
        type: 'signup',
      });
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('http://localhost:3000/merchant/dashboard');
    });

    it('token_hash con type=email válido intercambia y redirige por rol', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?token_hash=th_email_123&type=email'
      );
      const response = await GET(request);

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'th_email_123',
        type: 'email',
      });
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('http://localhost:3000/merchant/dashboard');
    });

    it('token_hash con type=recovery redirige a /reset-password', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?token_hash=th_recov_123&type=recovery'
      );
      const response = await GET(request);

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'th_recov_123',
        type: 'recovery',
      });
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('http://localhost:3000/reset-password');
    });
  });

  describe('Manejo de errores y enlaces inválidos', () => {
    it('sin parámetros en la URL redirige a /login?authError=link_invalid', async () => {
      const request = new NextRequest('http://localhost:3000/auth/confirm');
      const response = await GET(request);

      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
      expect(mockVerifyOtp).not.toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?authError=link_invalid'
      );
    });

    it('code expirado o inválido redirige a /login?authError=link_invalid', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Token has expired or is invalid', code: 'otp_expired' },
      });

      const request = new NextRequest('http://localhost:3000/auth/confirm?code=expired-code');
      const response = await GET(request);

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?authError=link_invalid'
      );
    });

    it('token_hash con error en verifyOtp redirige a /login?authError=link_invalid', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Token is invalid', code: 'bad_jwt' },
      });

      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?token_hash=bad_hash&type=signup'
      );
      const response = await GET(request);

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?authError=link_invalid'
      );
    });

    it('type no admitido (ej: magiclink, invite, phone_change) no llama a verifyOtp y va a /login?authError=link_invalid', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?token_hash=some_hash&type=invite'
      );
      const response = await GET(request);

      expect(mockVerifyOtp).not.toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?authError=link_invalid'
      );
    });

    it('token_hash sin type redirige a /login?authError=link_invalid', async () => {
      const request = new NextRequest('http://localhost:3000/auth/confirm?token_hash=only_hash');
      const response = await GET(request);

      expect(mockVerifyOtp).not.toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?authError=link_invalid'
      );
    });
  });

  describe('Seguridad contra Open Redirects y Allowlist de next', () => {
    it('ignora next con URL absoluta externa (ej: https://evil.com) y no produce redirect externo', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?code=valid-code&next=https://evil.com'
      );
      const response = await GET(request);

      expect(response.status).toBe(303);
      const location = response.headers.get('location');
      expect(location).toBe('http://localhost:3000/merchant/dashboard');
      expect(location).not.toContain('evil.com');
    });

    it('ignora next relativo malformado de protocolo (//evil.com o /\\evil.com)', async () => {
      const request1 = new NextRequest(
        'http://localhost:3000/auth/confirm?code=valid-code&next=//evil.com'
      );
      const response1 = await GET(request1);
      expect(response1.headers.get('location')).toBe('http://localhost:3000/merchant/dashboard');

      const request2 = new NextRequest(
        'http://localhost:3000/auth/confirm?code=valid-code&next=/\\evil.com'
      );
      const response2 = await GET(request2);
      expect(response2.headers.get('location')).toBe('http://localhost:3000/merchant/dashboard');
    });

    it('ignora cualquier ruta no perteneciente a la allowlist (solo /reset-password permitida)', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?code=valid-code&next=/admin/settings'
      );
      const response = await GET(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/merchant/dashboard');
    });

    it.each([
      ['next=%2F%2Fevil.com', '%2F%2Fevil.com'],
      ['next=https%3A%2F%2Fevil.com', 'https%3A%2F%2Fevil.com'],
      ['next=%2F%5Cevil.com', '%2F%5Cevil.com'],
      ['next=%252F%252Fevil.com', '%252F%252Fevil.com'],
    ])(
      'PR162-H03: ignora next percent-encoded (%s) y redirige al destino interno seguro sin host atacante',
      async (_label, encodedNext) => {
        const request = new NextRequest(
          `http://localhost:3000/auth/confirm?code=valid-code&next=${encodedNext}`
        );
        const response = await GET(request);

        expect(response.status).toBe(303);
        const location = response.headers.get('location') ?? '';
        expect(location).toBe('http://localhost:3000/merchant/dashboard');
        expect(location).not.toContain('evil.com');
        expect(location.startsWith('http://localhost:3000/')).toBe(true);
      }
    );
  });

  describe('Protección de datos sensibles', () => {
    it('la URL de redirect final jamás contiene code, token_hash, access_token ni error.message', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Database error occurred: code 500', code: 'internal' },
      });

      const request = new NextRequest(
        'http://localhost:3000/auth/confirm?code=secret-code-xyz&token_hash=secret-hash-123'
      );
      const response = await GET(request);

      const location = response.headers.get('location') ?? '';
      expect(location).not.toContain('secret-code-xyz');
      expect(location).not.toContain('secret-hash-123');
      expect(location).not.toContain('fake-access-token');
      expect(location).not.toContain('Database error');
      expect(location).toBe('http://localhost:3000/login?authError=link_invalid');
    });
  });
});
