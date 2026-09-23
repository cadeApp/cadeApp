import { toast } from 'sonner';

export interface NotifyOptions {
  id?: string;
  description?: string;
  duration?: number;
}

const activeToastIds = new Set<string>();

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

  activeToastIds.add(resolvedId);

  const cleanup = () => {
    activeToastIds.delete(resolvedId);
  };

  return toast[kind](safeMessage, {
    id: resolvedId,
    description: safeDescription,
    duration: options?.duration ?? (kind === 'error' ? 5000 : 3500),
    onDismiss: cleanup,
    onAutoClose: cleanup,
  });
}

export const notify = {
  success(message: string, options?: NotifyOptions) {
    return dispatchToast('success', message, options);
  },
  error(message: string, options?: NotifyOptions) {
    return dispatchToast('error', message, options);
  },
  info(message: string, options?: NotifyOptions) {
    return dispatchToast('info', message, options);
  },
  resetActiveToasts() {
    activeToastIds.clear();
  },
};
