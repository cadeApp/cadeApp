export const DOMAIN_ERROR_CODES = [
  // Auth, sesión y autorización
  'UNAUTHENTICATED',
  'UNAUTHORIZED_ACTOR',
  'AAL2_REQUIRED',
  'INVALID_SIGNUP_ROLE',
  'DNI_ALREADY_REGISTERED',

  // Ofertas y elegibilidad de repartidor (T-101, T-102)
  'OFFER_BELOW_MINIMUM',
  'ALREADY_MATCHED',
  'DUPLICATE_ACTIVE_OFFER',
  'OFFER_NOT_PENDING',
  'COURIER_NOT_APPROVED',
  'COURIER_SUSPENDED',
  'COURIER_UNAVAILABLE',
  'RATE_LIMITED',

  // Ciclo de vida de solicitudes, suscripción y geolocalización (T-103, T-106)
  'REQUEST_EXPIRED',
  'INVALID_STATE_TRANSITION',
  'SUBSCRIPTION_INACTIVE',
  'REASON_REQUIRED',
  'INCIDENT_WINDOW_EXPIRED',
  'OUT_OF_BOUNDS_AGUILARES',
  'INVALID_ZONE',
  'MISSING_REQUIRED_FIELDS',

  // Administración y plataforma (T-105)
  'INVALID_SETTING_KEY',
  'INVALID_SETTING_VALUE',

  // Errores transversales / infraestructura
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
] as const;

export const ALL_DOMAIN_ERROR_CODES = DOMAIN_ERROR_CODES;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

const DOMAIN_ERROR_SET: ReadonlySet<string> = new Set(DOMAIN_ERROR_CODES);

export function isDomainErrorCode(value: unknown): value is DomainErrorCode {
  return typeof value === 'string' && DOMAIN_ERROR_SET.has(value);
}

export type ActionSuccess<T> = {
  readonly ok: true;
  readonly data: T;
};

export type ActionFailure<E extends DomainErrorCode = DomainErrorCode> = {
  readonly ok: false;
  readonly code: E;
};

export type ActionResult<T, E extends DomainErrorCode = DomainErrorCode> =
  ActionSuccess<T> | ActionFailure<E>;

export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function err<E extends DomainErrorCode = DomainErrorCode>(code: E): ActionFailure<E> {
  return { ok: false, code };
}

export function isOk<T, E extends DomainErrorCode>(
  result: ActionResult<T, E>
): result is ActionSuccess<T> {
  return result.ok;
}

export function isErr<T, E extends DomainErrorCode>(
  result: ActionResult<T, E>
): result is ActionFailure<E> {
  return !result.ok;
}
