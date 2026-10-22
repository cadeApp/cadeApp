/**
 * T-391 (SEC-05): cabeceras de seguridad para todas las rutas, páginas y `/api`.
 *
 * - Se fuerzan solo las directivas que no dependen de scripts y no pueden romper la app: `frame-ancestors`,
 *   `object-src`, `base-uri` y `form-action`, más `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
 *   `Permissions-Policy` y HSTS fuera de desarrollo.
 * - La CSP completa va en `Content-Security-Policy-Report-Only`: Next inyecta scripts inline y Google Maps carga
 *   recursos de varios hosts, así que se observa primero y se fuerza en Fase 4 (T-409) con los reportes reales.
 */

export interface SecurityHeadersOptions {
  /** `NEXT_PUBLIC_SUPABASE_URL`; sin ella, la CSP no habilita Supabase (REST, Storage ni Realtime). */
  readonly supabaseUrl?: string;
  /** `true` en `next dev`: sin HSTS y con `unsafe-eval` para el refresco en caliente. */
  readonly isDevelopment: boolean;
}

export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

const GOOGLE_MAPS_SCRIPT_HOSTS = ['https://maps.googleapis.com', 'https://maps.gstatic.com'];
const GOOGLE_MAPS_ASSET_HOSTS = ['https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com'];

export const ENFORCED_CSP = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

export const PERMISSIONS_POLICY = 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)';

export const HSTS = 'max-age=63072000; includeSubDomains';

/**
 * Origen http(s) y ws(s) de Supabase, o `null` si la URL falta, no es válida o usa otro esquema. Solo se admite
 * `https:`; `http:` únicamente en desarrollo local.
 */
function supabaseOrigins(
  supabaseUrl: string | undefined,
  isDevelopment: boolean
): { https: string; wss: string } | null {
  if (!supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol === 'https:') return { https: url.origin, wss: `wss://${url.host}` };
    if (url.protocol === 'http:' && isDevelopment) return { https: url.origin, wss: `ws://${url.host}` };
    return null;
  } catch {
    return null;
  }
}

export function buildReportOnlyCsp({ supabaseUrl, isDevelopment }: SecurityHeadersOptions): string {
  const supabase = supabaseOrigins(supabaseUrl, isDevelopment);
  const supabaseHttp = supabase ? [supabase.https] : [];
  const supabaseRealtime = supabase ? [supabase.wss] : [];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : []), ...GOOGLE_MAPS_SCRIPT_HOSTS],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': ["'self'", 'data:', 'blob:', ...supabaseHttp, ...GOOGLE_MAPS_SCRIPT_HOSTS, ...GOOGLE_MAPS_ASSET_HOSTS],
    'connect-src': ["'self'", ...supabaseHttp, ...supabaseRealtime, ...GOOGLE_MAPS_SCRIPT_HOSTS, ...GOOGLE_MAPS_ASSET_HOSTS],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

export function buildSecurityHeaders(options: SecurityHeadersOptions): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'Content-Security-Policy', value: ENFORCED_CSP },
    { key: 'Content-Security-Policy-Report-Only', value: buildReportOnlyCsp(options) },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  ];

  if (!options.isDevelopment) {
    headers.push({ key: 'Strict-Transport-Security', value: HSTS });
  }

  return headers;
}
