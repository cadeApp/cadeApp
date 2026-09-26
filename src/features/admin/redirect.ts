/**
 * Sanitiza un destino redirectTo asegurando que pertenezca al área admin interna
 * y no contenga esquemas maliciosos (javascript:, data:), URLs externas (https:, //),
 * backslashes ni caracteres de control CR/LF.
 */
export function sanitizeAdminRedirect(rawRedirectTo: unknown): string {
  const fallback = '/admin/applicants';
  if (typeof rawRedirectTo !== 'string') {
    return fallback;
  }

  const trimmed = rawRedirectTo.trim();
  if (
    !trimmed ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /[\r\n]/.test(trimmed) ||
    /^(javascript|data|vbscript):/i.test(trimmed) ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return fallback;
  }

  // Debe ser un path relativo interno que empiece con /admin
  const [pathname, query] = trimmed.split('?');
  if (!pathname || (pathname !== '/admin' && !pathname.startsWith('/admin/'))) {
    return fallback;
  }

  return query ? `${pathname}?${query}` : pathname;
}
