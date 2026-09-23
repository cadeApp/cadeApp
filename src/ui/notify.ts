import { toast } from 'sonner';

import type { DomainErrorCode } from '@/domain/errors';
import { DOMAIN_ERROR_MESSAGES, getDomainErrorMessage } from '@/lib/error-messages';

export { DOMAIN_ERROR_MESSAGES, getDomainErrorMessage };

export interface NotifyOptions {
  id?: string;
  description?: string;
  duration?: number;
}

export interface NotifyPromiseMessages<T> {
  loading: string;
  success: string | ((data: T) => string);
  error: DomainErrorCode | string | ((error: unknown) => DomainErrorCode | string);
}

/**
 * Sanitiza mensajes de notificación para impedir fugas accidentales de PII
 * (D15: teléfonos internacionales o nacionales de formatPhone y direcciones no deben mostrarse en toasts).
 */
export function sanitizeToastMessage(rawMessage: string): string {
  const withoutPhone = rawMessage
    .replace(
      /(?:(?:\+54|\b54)\s*(?:9\s*)?)?(?:0?\d{2,4})[\s-]*(?:15[\s-]*)?\d{2,4}[\s-]*\d{4}\b/g,
      '[teléfono oculto]'
    )
    .replace(/(?:\+54\s*9?\s*|\b54\s*9?\s*)\d{8,11}\b/g, '[teléfono oculto]');
  return withoutPhone;
}

function buildDedupeId(kind: 'success' | 'error' | 'info', message: string, explicitId?: string): string {
  if (explicitId) {
    return explicitId;
  }
  return `${kind}:${message.trim().toLowerCase()}`;
}

function dispatchToast(
  kind: 'success' | 'error' | 'info',
  message: string,
  options?: NotifyOptions
): string | number {
  const safeMessage = sanitizeToastMessage(message);
  const safeDescription = options?.description
    ? sanitizeToastMessage(options.description)
    : undefined;
  const resolvedId = buildDedupeId(kind, safeMessage, options?.id);

  return toast[kind](safeMessage, {
    id: resolvedId,
    description: safeDescription,
    duration: options?.duration ?? (kind === 'error' ? 5000 : 3500),
  });
}

export const notify = {
  success(message: string, options?: NotifyOptions) {
    return dispatchToast('success', message, options);
  },
  error(codeOrMessage: DomainErrorCode | string, options?: NotifyOptions) {
    const resolvedMessage = getDomainErrorMessage(codeOrMessage);
    return dispatchToast('error', resolvedMessage, options);
  },
  info(message: string, options?: NotifyOptions) {
    return dispatchToast('info', message, options);
  },
  promise<T>(promise: Promise<T> | (() => Promise<T>), messages: NotifyPromiseMessages<T>) {
    return toast.promise(promise, {
      loading: sanitizeToastMessage(messages.loading),
      success: (data: T) => {
        const raw = typeof messages.success === 'function' ? messages.success(data) : messages.success;
        return sanitizeToastMessage(raw);
      },
      error: (err: unknown) => {
        const rawCodeOrMessage =
          typeof messages.error === 'function' ? messages.error(err) : messages.error;
        return sanitizeToastMessage(getDomainErrorMessage(rawCodeOrMessage));
      },
    });
  },
};
