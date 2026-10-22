import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import {
  buildReportOnlyCsp,
  buildSecurityHeaders,
  ENFORCED_CSP,
  HSTS,
  PERMISSIONS_POLICY,
  type SecurityHeader,
} from './headers';

const SUPABASE_URL = 'https://abcd1234.supabase.co';

function headerMap(headers: readonly SecurityHeader[]): Map<string, string> {
  return new Map(headers.map((h) => [h.key, h.value]));
}

describe('T-391: cabeceras de seguridad', () => {
  it('fuerza las cabeceras que no dependen de scripts', () => {
    const headers = headerMap(buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDevelopment: false }));

    expect(headers.get('Content-Security-Policy')).toBe(ENFORCED_CSP);
    expect(ENFORCED_CSP).toContain("frame-ancestors 'none'");
    expect(ENFORCED_CSP).toContain("object-src 'none'");
    expect(ENFORCED_CSP).toContain("base-uri 'self'");
    expect(ENFORCED_CSP).toContain("form-action 'self'");
    expect(ENFORCED_CSP).not.toMatch(/script-src|default-src/);
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toBe(PERMISSIONS_POLICY);
    expect(PERMISSIONS_POLICY).toContain('geolocation=(self)');
    expect(PERMISSIONS_POLICY).toContain('camera=()');
  });

  it('agrega HSTS fuera de desarrollo y no en desarrollo', () => {
    const prod = headerMap(buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDevelopment: false }));
    const dev = headerMap(buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDevelopment: true }));

    expect(prod.get('Strict-Transport-Security')).toBe(HSTS);
    expect(dev.has('Strict-Transport-Security')).toBe(false);
  });

  it('la CSP completa va en Report-Only con Supabase (https y wss) y Google Maps', () => {
    const csp = buildReportOnlyCsp({ supabaseUrl: SUPABASE_URL, isDevelopment: false });
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
  });

  it('en desarrollo permite unsafe-eval y una URL local de Supabase por ws', () => {
    const csp = buildReportOnlyCsp({ supabaseUrl: 'http://127.0.0.1:54321', isDevelopment: true });

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain('ws://127.0.0.1:54321');
  });

  it('sin URL de Supabase válida no inventa orígenes', () => {
    const csp = buildReportOnlyCsp({ supabaseUrl: 'no-es-una-url', isDevelopment: false });

    expect(csp).not.toContain('no-es-una-url');
    expect(csp).not.toContain('wss://');
  });

  it.each([
    ['ftp://abcd1234.supabase.co', false],
    ['javascript:alert(1)', false],
    ['http://abcd1234.supabase.co', false],
    ['ftp://127.0.0.1:54321', true],
  ])('rechaza el esquema de %s (desarrollo: %s)', (supabaseUrl, isDevelopment) => {
    const csp = buildReportOnlyCsp({ supabaseUrl, isDevelopment });

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
        'Content-Security-Policy-Report-Only',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
      ])
    );
  });
});
