import { toast } from 'sonner';
import { isDomainErrorCode, type DomainErrorCode } from '@/domain';

/**
 * Mensajes oficiales en español rioplatense (es-AR) para los 27 códigos de `DomainErrorCode`.
 */
export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  UNAUTHENTICATED: 'Tenés que iniciar sesión para continuar.',
  UNAUTHORIZED_ACTOR: 'No tenés permiso para realizar esta acción.',
  AAL2_REQUIRED: 'Esta acción administrativa requiere verificación en dos pasos (AAL2).',
  INVALID_SIGNUP_ROLE: 'Seleccioná un rol válido (comercio o repartidor) para registrarte.',
  DNI_ALREADY_REGISTERED: 'Ya existe una cuenta registrada con ese número de DNI.',
  OFFER_BELOW_MINIMUM: 'El monto ingresado está por debajo del piso mínimo vigente.',
  ALREADY_MATCHED: 'Otro repartidor ya fue asignado a esta solicitud.',
  DUPLICATE_ACTIVE_OFFER: 'Ya enviaste una oferta activa para esta solicitud.',
  OFFER_NOT_PENDING: 'La oferta ya no se encuentra pendiente.',
  COURIER_NOT_APPROVED: 'Tu cuenta de repartidor todavía no fue aprobada.',
  COURIER_SUSPENDED: 'Tu cuenta de repartidor se encuentra suspendida.',
  COURIER_UNAVAILABLE: 'Activá tu disponibilidad antes de enviar una oferta.',
  RATE_LIMITED: 'Demasiados intentos seguidos. Esperá unos segundos y volvé a probar.',
  REQUEST_EXPIRED: 'La solicitud venció antes de completarse la operación.',
  INVALID_STATE_TRANSITION: 'La solicitud cambió de estado. Actualizá la pantalla.',
  SUBSCRIPTION_INACTIVE:
    'Tu suscripción no está activa. Contactá al administrador para habilitarla.',
  REASON_REQUIRED: 'Ingresá el motivo para confirmar esta acción.',
  INCIDENT_WINDOW_EXPIRED:
    'Ya pasaron más de 24 horas desde la entrega para reportar un incidente.',
  OUT_OF_BOUNDS_AGUILARES: 'Las coordenadas seleccionadas están fuera de Aguilares.',
  INVALID_ZONE: 'Seleccioná un barrio válido de Aguilares.',
  MISSING_REQUIRED_FIELDS: 'Completá todos los datos obligatorios antes de continuar.',
  INVALID_SETTING_KEY: 'El parámetro de configuración indicado no existe.',
  INVALID_SETTING_VALUE: 'El valor ingresado para el parámetro no es válido.',
  VALIDATION_ERROR: 'Revisá los datos ingresados e intentá nuevamente.',
  NOT_FOUND: 'No encontramos el registro solicitado.',
  CONFLICT: 'La operación entró en conflicto con un cambio reciente. Intentá de nuevo.',
  INTERNAL_ERROR: 'Ocurrió un inconveniente inesperado. Intentá nuevamente en unos instantes.',
};

export interface NotifyOptions {
  id?: string;
  description?: string;
}

const activeToastIds = new Set<string>();

function sanitizeToastMessage(text: string): string {
  // Regla 60: Nada de datos personales (ej. teléfonos) en un toast
  return text.replace(/\+?54\s*9?\s*\d{6,12}/g, '[teléfono protegido]');
}

function emitDeduplicated(
  kind: 'success' | 'error' | 'info',
  message: string,
  resolvedId: string,
  options?: NotifyOptions
): string {
  const cleanMessage = sanitizeToastMessage(message);
  if (activeToastIds.has(resolvedId)) {
    return resolvedId;
  }

  activeToastIds.add(resolvedId);
  const fn = kind === 'success' ? toast.success : kind === 'error' ? toast.error : toast.info;
  fn(cleanMessage, {
    id: resolvedId,
    description: options?.description ? sanitizeToastMessage(options.description) : undefined,
    onDismiss: () => {
      activeToastIds.delete(resolvedId);
    },
    onAutoClose: () => {
      activeToastIds.delete(resolvedId);
    },
  });

  return resolvedId;
}

/**
 * Helper centralizado `notify` de `src/ui/notify.ts` (Regla 60).
 * Las features nunca importan `sonner` directo.
 * Reemplaza/deduplica toasts por `id` para evitar cascadas.
 */
export const notify = {
  success(message: string, options?: NotifyOptions): string {
    const resolvedId = options?.id ?? `toast:success:${message}`;
    return emitDeduplicated('success', message, resolvedId, options);
  },

  error(codeOrMessage: DomainErrorCode | string, options?: NotifyOptions): string {
    const isCode = isDomainErrorCode(codeOrMessage);
    const message = isCode ? DOMAIN_ERROR_MESSAGES[codeOrMessage] : codeOrMessage;
    const resolvedId =
      options?.id ?? (isCode ? `domain-error:${codeOrMessage}` : `toast:error:${message}`);
    return emitDeduplicated('error', message, resolvedId, options);
  },

  info(message: string, options?: NotifyOptions): string {
    const resolvedId = options?.id ?? `toast:info:${message}`;
    return emitDeduplicated('info', message, resolvedId, options);
  },

  promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: DomainErrorCode | string },
    options?: NotifyOptions
  ): Promise<T> {
    const errorText = isDomainErrorCode(messages.error)
      ? DOMAIN_ERROR_MESSAGES[messages.error]
      : messages.error;
    const resolvedId = options?.id ?? `toast:promise:${messages.loading}`;
    toast.promise(promise, {
      id: resolvedId,
      loading: sanitizeToastMessage(messages.loading),
      success: sanitizeToastMessage(messages.success),
      error: sanitizeToastMessage(errorText),
    });
    return promise;
  },

  /** Limpia el registro en memoria de toasts activos durante las pruebas unitarias. */
  _resetActiveToastsForTests(): void {
    activeToastIds.clear();
  },
};
