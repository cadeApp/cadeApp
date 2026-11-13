import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  HSTS,
  PERMISSIONS_POLICY,
  type SecurityHeader,
} from './headers';

const SUPABASE_URL = 'https://abcd1234.supabase.co';

function headerMap(headers: readonly SecurityHeader[]): Map<string, string> {
  return new Map(headers.map((h) => [h.key, h.value]));
}

describe('T-391 / T-436: cabeceras de seguridad', () => {
  it('fuerza la CSP completa y no envía Report-Only', () => {
    const headers = headerMap(buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDevelopment: false }));
    const csp = headers.get('Content-Security-Policy') ?? '';

    expect(csp).toBe(buildContentSecurityPolicy({ supabaseUrl: SUPABASE_URL, isDevelopment: false }));
    for (const directive of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "manifest-src 'self'",
    ]) {
      expect(csp, directive).toContain(directive);
    }
    expect(csp).toMatch(/(^|; )script-src /);
    expect(csp).toMatch(/(^|; )connect-src /);
    expect(headers.has('Content-Security-Policy-Report-Only')).toBe(false);
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toBe(PERMISSIONS_POLICY);
    expect(PERMISSIONS_POLICY).toContain('geolocation=(self)');
    expect(PERMISSIONS_POLICY).toContain('camera=()');
  });

  it('la CSP forzada de producción es exactamente la matriz esperada de directivas y orígenes', () => {
    const csp = buildContentSecurityPolicy({ supabaseUrl: SUPABASE_URL, isDevelopment: false });
    const parsed = Object.fromEntries(
      csp.split('; ').map((directive) => {
        const [name = '', ...sources] = directive.split(' ');
        return [name, sources];
      })
    );
    const mapsScript = ['https://maps.googleapis.com', 'https://maps.gstatic.com'];
    const googleWildcards = ['https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com'];

    // Matriz literal independiente del código probado: cualquier alta, baja o cambio de orden rompe el test.
    expect(parsed).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", ...mapsScript],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https://abcd1234.supabase.co', ...mapsScript, ...googleWildcards],
      'connect-src': [
        "'self'",
        'https://abcd1234.supabase.co',
        'wss://abcd1234.supabase.co',
        ...mapsScript,
        ...googleWildcards,
      ],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
      'worker-src': ["'self'", 'blob:'],
      'manifest-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    });
  });

  it('agrega HSTS fuera de desarrollo y no en desarrollo', () => {
    const prod = headerMap(buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDevelopment: false }));
    const dev = headerMap(buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDevelopment: true }));

    expect(prod.get('Strict-Transport-Security')).toBe(HSTS);
    expect(dev.has('Strict-Transport-Security')).toBe(false);
  });

  it('la CSP forzada habilita Supabase (https y wss) y Google Maps, sin unsafe-eval en producción', () => {
    const csp = buildContentSecurityPolicy({ supabaseUrl: SUPABASE_URL, isDevelopment: false });
    const connect = csp.split('; ').find((d) => d.startsWith('connect-src ')) ?? '';
    const img = csp.split('; ').find((d) => d.startsWith('img-src ')) ?? '';
    const script = csp.split('; ').find((d) => d.startsWith('script-src ')) ?? '';

    expect(connect).toContain(SUPABASE_URL);
    expect(connect).toContain('wss://abcd1234.supabase.co');
    expect(img).toContain(SUPABASE_URL);
    expect(script).toContain('https://maps.googleapis.com');
    expect(script).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).not.toMatch(/(^|[ ;])(\*|https:)( |;|$)/);
  });

  it('sin URL de Supabase no habilita ningún origen de Supabase', () => {
    const csp = buildContentSecurityPolicy({ isDevelopment: false });

    expect(csp).not.toContain('supabase');
    expect(csp).not.toMatch(/wss?:\/\//);
  });

  it('en desarrollo permite unsafe-eval y una URL local de Supabase por ws', () => {
    const csp = buildContentSecurityPolicy({ supabaseUrl: 'http://127.0.0.1:54321', isDevelopment: true });

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain('ws://127.0.0.1:54321');
  });

  it('sin URL de Supabase válida no inventa orígenes', () => {
    const csp = buildContentSecurityPolicy({ supabaseUrl: 'no-es-una-url', isDevelopment: false });

    expect(csp).not.toContain('no-es-una-url');
    expect(csp).not.toContain('wss://');
  });

  it.each([
    ['ftp://abcd1234.supabase.co', false],
    ['javascript:alert(1)', false],
    ['http://abcd1234.supabase.co', false],
    ['ftp://127.0.0.1:54321', true],
  ])('rechaza el esquema de %s (desarrollo: %s)', (supabaseUrl, isDevelopment) => {
    const csp = buildContentSecurityPolicy({ supabaseUrl, isDevelopment });

    expect(csp).not.toMatch(/ftp:|javascript:|null|wss?:\/\/|http:\/\//);
  });

  it('next.config aplica las cabeceras a todas las rutas y no anuncia el framework', async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = (await nextConfig.headers?.()) ?? [];

    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe('/(.*)');
    const keys = (rules[0]?.headers ?? []).map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
      ])
    );
    expect(keys).not.toContain('Content-Security-Policy-Report-Only');
  });
});
