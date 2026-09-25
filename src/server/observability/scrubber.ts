import 'server-only';

// Patrones regulares para detección de PII (Personally Identifiable Information)
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Teléfonos de Argentina: +54, 9, códigos de área como 3865 (Aguilares), 381 (Tucumán), 11 (CABA)
const PHONE_REGEX = /(?:\+?54\s?9?\s?)?(?:0?[1-9]\d{1,3}[-\s]?)?\d{6,8}\b/g;
// DNI argentino: números de 7 u 8 dígitos antecedidos por DNI o en contexto de identificación
const DNI_TEXT_REGEX = /\b(?:DNI|dni|documento)?\s*([1-9]\d{6,7})\b/g;
// Tokens Bearer / JWT (formato header.payload.signature en base64url)
const JWT_BEARER_REGEX = /Bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
const GENERIC_JWT_REGEX = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g;

// Claves de objetos que contienen PII o datos sensibles del destinatario
const SENSITIVE_KEYS = new Set([
  'recipient_name',
  'recipient_phone',
  'delivery_address',
  'notes',
  'dni',
  'document_number',
  'selfie',
  'dni_front',
  'dni_back',
  'password',
  'token',
  'secret',
  'service_role',
  'apikey',
  'authorization',
]);

/**
 * Sanitiza una cadena de texto sustituyendo datos personales por marcadores redactados.
 */
export function scrubString(str: string): string {
  let result = str;

  // 1. Redactar Bearer y tokens JWT primero (tienen estructura larga)
  result = result.replace(JWT_BEARER_REGEX, 'Bearer [REDACTED_TOKEN]');
  result = result.replace(GENERIC_JWT_REGEX, '[REDACTED_TOKEN]');

  // 2. Redactar emails
  result = result.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');

  // 3. Redactar DNI explícito en texto (si dice DNI 12345678 o similar)
  result = result.replace(DNI_TEXT_REGEX, (match, dniDigits) => {
    if (dniDigits && dniDigits.length >= 7 && dniDigits.length <= 8) {
      return match.replace(dniDigits, '[REDACTED_DNI]');
    }
    return match;
  });

  // 4. Redactar números de teléfono argentinos
  result = result.replace(PHONE_REGEX, (match) => {
    // Evitar falsos positivos con números pequeños o timestamps
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 8 && digitsOnly.length <= 13) {
      return '[REDACTED_PHONE]';
    }
    return match;
  });

  return result;
}

/**
 * Sanitiza un valor arbitrario (string, object, array, Error) asegurando que no queden datos personales.
 * Produce un clon nuevo; no muta el argumento original.
 */
export function scrubPii<T>(target: T): T {
  if (target == null) {
    return target;
  }

  if (typeof target === 'string') {
    return scrubString(target) as unknown as T;
  }

  if (target instanceof Error) {
    const sanitizedError = new Error(scrubString(target.message));
    sanitizedError.name = target.name;
    if (target.stack) {
      sanitizedError.stack = scrubString(target.stack);
    }
    return sanitizedError as unknown as T;
  }

  if (Array.isArray(target)) {
    return target.map((item) => scrubPii(item)) as unknown as T;
  }

  if (typeof target === 'object') {
    const sanitizedObj: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Si la clave es sensible por contrato, aplicar redacción específica
      if (lowerKey === 'recipient_phone') {
        sanitizedObj[key] = '[REDACTED_PHONE]';
      } else if (lowerKey === 'dni' || lowerKey === 'document_number') {
        sanitizedObj[key] = '[REDACTED_DNI]';
      } else if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitizedObj[key] = '[REDACTED_PII]';
      } else if (typeof value === 'string') {
        sanitizedObj[key] = scrubString(value);
      } else {
        sanitizedObj[key] = scrubPii(value);
      }
    }

    return sanitizedObj as T;
  }

  return target;
}
