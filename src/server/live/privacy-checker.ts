import 'server-only';

/**
 * Utilidades de verificación estricta de privacidad sobre payloads crudos de red.
 *
 * Se inspecciona la estructura JSON deserializada cruda ANTES de cualquier
 * transformación de esquema Zod, dado que z.object descarta claves desconocidas
 * por defecto y podría ocultar fugas de información confidencial.
 */

export const FORBIDDEN_PRIVATE_KEYS = [
  'recipient_name',
  'recipientName',
  'recipient_phone',
  'recipientPhone',
  'dropoff_address',
  'dropoffAddress',
  'dropoff_lat',
  'dropoffLat',
  'dropoff_lng',
  'dropoffLng',
  'notes',
  'deliveryNotes',
  'delivery_notes',
  'cash_change_amount',
  'cashChangeAmount',
  'pin',
  'pin_code',
  'pinCode',
] as const;

export type ForbiddenPrivateKey = (typeof FORBIDDEN_PRIVATE_KEYS)[number];

const FORBIDDEN_KEYS_SET = new Set<string>(
  FORBIDDEN_PRIVATE_KEYS.map((k) => k.toLowerCase())
);

export interface PrivacyViolation {
  path: string;
  type: 'forbidden_key' | 'forbidden_value';
  detail: string;
}

/**
 * Inspecciona recursivamente un payload crudo buscando claves privadas prohibidas
 * y valores marcadores confidenciales.
 */
export function findRawPayloadPrivacyViolations(
  payload: unknown,
  forbiddenValues: (string | number)[] = [],
  currentPath: string = '$'
): PrivacyViolation[] {
  const violations: PrivacyViolation[] = [];

  if (payload === null || payload === undefined) {
    return violations;
  }

  // Comprobar valores primitivos contra valores prohibidos
  if (typeof payload === 'string' || typeof payload === 'number') {
    const strVal = String(payload);
    for (const forbidden of forbiddenValues) {
      const forbiddenStr = String(forbidden);
      if (forbiddenStr.length > 0 && strVal.includes(forbiddenStr)) {
        violations.push({
          path: currentPath,
          type: 'forbidden_value',
          detail: `Valor prohibido detectado: '${forbiddenStr}'`,
        });
      }
    }
    return violations;
  }

  // Recorrer arrays
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => {
      violations.push(
        ...findRawPayloadPrivacyViolations(
          item,
          forbiddenValues,
          `${currentPath}[${index}]`
        )
      );
    });
    return violations;
  }

  // Recorrer objetos
  if (typeof payload === 'object') {
    for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_KEYS_SET.has(lowerKey)) {
        violations.push({
          path: `${currentPath}.${key}`,
          type: 'forbidden_key',
          detail: `Clave privada prohibida detectada: '${key}'`,
        });
      }

      // También verificar si el nombre de la clave contiene un valor prohibido
      for (const forbidden of forbiddenValues) {
        const forbiddenStr = String(forbidden);
        if (forbiddenStr.length > 0 && key.includes(forbiddenStr)) {
          violations.push({
            path: `${currentPath}.${key}`,
            type: 'forbidden_value',
            detail: `Nombre de clave contiene valor prohibido: '${forbiddenStr}'`,
          });
        }
      }

      violations.push(
        ...findRawPayloadPrivacyViolations(
          val,
          forbiddenValues,
          `${currentPath}.${key}`
        )
      );
    }
  }

  return violations;
}

/**
 * Lanza un error detallado si se detecta cualquier clave prohibida o valor privado
 * en el payload crudo recibido.
 */
export function assertNoPrivateFieldsInRawPayload(
  payload: unknown,
  forbiddenValues: (string | number)[] = []
): void {
  const violations = findRawPayloadPrivacyViolations(payload, forbiddenValues);
  if (violations.length > 0) {
    const errorDetails = violations
      .map((v) => `[${v.path}] (${v.type}): ${v.detail}`)
      .join('\n');
    throw new Error(
      `Fuga de privacidad detectada en payload crudo (${violations.length} violación/es):\n${errorDetails}`
    );
  }
}
