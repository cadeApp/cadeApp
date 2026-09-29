import { isDomainErrorCode, type DomainErrorCode } from '@/domain/errors';

/**
 * Diccionario de mensajes en español rioplatense (es-AR) para cada
 * `DomainErrorCode` de cadeApp (D05, R01, regla 20 §8).
 */
export const DOMAIN_ERROR_MESSAGES = {
  // Auth, sesión y autorización
  UNAUTHENTICATED: 'Tu sesión venció. Volvé a iniciar sesión para continuar.',
  UNAUTHORIZED_ACTOR: 'No tenés permisos para realizar esta acción.',
  AAL2_REQUIRED: 'Ingresá tu código de verificación en dos pasos para continuar.',
  INVALID_SIGNUP_ROLE: 'Seleccioná si entrás como comercio o como repartidor.',
  DNI_ALREADY_REGISTERED: 'Ese DNI ya está registrado en cadeApp.',

  // Ofertas y elegibilidad de repartidor (T-101, T-102)
  OFFER_BELOW_MINIMUM: 'La oferta es menor al monto mínimo permitido.',
  ALREADY_MATCHED: 'Otro repartidor ya fue asignado a este pedido.',
  DUPLICATE_ACTIVE_OFFER: 'Ya tenés una oferta activa para este pedido.',
  OFFER_NOT_PENDING: 'Esta oferta ya no está disponible para aceptarse.',
  COURIER_NOT_APPROVED: 'Tu cuenta de repartidor todavía está en revisión.',
  COURIER_SUSPENDED: 'Tu cuenta está suspendida temporalmente. Contactá al soporte.',
  COURIER_UNAVAILABLE: 'Activá tu disponibilidad antes de enviar ofertas.',
  RATE_LIMITED: 'Enviaste demasiadas solicitudes seguidas. Esperá unos segundos.',

  // Ciclo de vida de solicitudes, suscripción y geolocalización (T-103, T-106)
  REQUEST_EXPIRED: 'La solicitud venció por falta de ofertas a tiempo.',
  INVALID_STATE_TRANSITION: 'El estado actual del pedido no permite este cambio.',
  SUBSCRIPTION_INACTIVE: 'Tu suscripción está vencida. Regularizala para publicar pedidos.',
  REASON_REQUIRED: 'Ingresá el motivo antes de confirmar la cancelación o incidencia.',
  INCIDENT_WINDOW_EXPIRED: 'Ya pasó el tiempo límite para reportar una incidencia en este envío.',
  OUT_OF_BOUNDS_AGUILARES: 'La dirección está fuera de la zona de cobertura en Aguilares.',
  INVALID_ZONE: 'Seleccioná un barrio válido de Aguilares.',
  MISSING_REQUIRED_FIELDS: 'Completá todos los datos obligatorios del formulario.',

  // Administración y plataforma (T-105)
  INVALID_SETTING_KEY: 'El parámetro de configuración indicado no existe.',
  INVALID_SETTING_VALUE: 'El valor ingresado no es válido para este parámetro.',

  // Errores transversales / infraestructura
  VALIDATION_ERROR: 'Revisá los datos ingresados: hay campos con formato inválido.',
  NOT_FOUND: 'No encontramos el registro solicitado.',
  CONFLICT: 'El registro fue modificado recientemente. Actualizá la pantalla e intentá de nuevo.',
  INTERNAL_ERROR: 'Ocurrió un inconveniente inesperado. Intentá nuevamente en unos instantes.',
} as const satisfies Record<DomainErrorCode, string>;

/**
 * Traduce un `DomainErrorCode` a su mensaje en español rioplatense (`es-AR`),
 * o devuelve el mensaje literal si se pasa un string personalizado.
 */
export function getDomainErrorMessage(codeOrMessage: DomainErrorCode | string): string {
  if (isDomainErrorCode(codeOrMessage)) {
    return DOMAIN_ERROR_MESSAGES[codeOrMessage];
  }
  return codeOrMessage;
}
