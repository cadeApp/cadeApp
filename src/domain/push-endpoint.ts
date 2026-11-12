// CC-049 (SEC-07): servicios push permitidos. Misma regla que app_private.is_allowed_push_endpoint en SQL.
const ALLOWED_PUSH_HOSTS: ReadonlySet<string> = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

// https, host sin userinfo/escapes/IPv6, puerto ausente o :443, y `/` después.
const PUSH_ENDPOINT_PATTERN = /^https:\/\/([^/:@\\%[\]\s]+)(?::443)?\//;
const WNS_HOST_PATTERN = /^[a-z0-9-]+\.notify\.windows\.com$/;

/** CC-049: `true` solo si el endpoint es de FCM, Mozilla, Apple o WNS (un subdominio de una etiqueta). */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  const match = PUSH_ENDPOINT_PATTERN.exec(endpoint);
  const host = match?.[1]?.toLowerCase();
  if (host === undefined) return false;
  return ALLOWED_PUSH_HOSTS.has(host) || WNS_HOST_PATTERN.test(host);
}
